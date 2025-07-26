import { OCRConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';
import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';

export interface OCRDocument {
  content: Buffer | string; // Buffer for binary data, string for base64
  mimeType: string;
  filename?: string;
}

export interface OCROptions {
  language?: string;
  extractTables?: boolean;
  extractForms?: boolean;
  confidence?: number;
  preprocessImage?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: TextBlock[];
  tables?: TableData[];
  forms?: FormData[];
  metadata: {
    pageCount: number;
    language: string;
    processingTime: number;
  };
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  words: Word[];
}

export interface Word {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TableData {
  rows: TableRow[];
  confidence: number;
  boundingBox: BoundingBox;
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableCell {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  rowSpan?: number;
  colSpan?: number;
}

export interface FormData {
  fields: FormField[];
  confidence: number;
}

export interface FormField {
  name: string;
  value: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export class OCRService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private googleVisionClient?: AxiosInstance;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeClients();
  }

  private initializeClients(): void {
    const config = this.configManager.getConfig<OCRConfig>('ocr-google-vision');
    
    if (config?.enabled && config.apiKey) {
      this.googleVisionClient = axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    }
  }

  public async extractText(
    document: OCRDocument,
    options: OCROptions = {}
  ): Promise<IntegrationResponse<OCRResult>> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      const config = this.configManager.getConfig<OCRConfig>('ocr-google-vision');
      if (!config?.enabled) {
        throw new Error('OCR service is not enabled');
      }

      // Validate file type
      if (!config.supportedFormats.includes(document.mimeType)) {
        throw new Error(`Unsupported file type: ${document.mimeType}`);
      }

      // Validate file size
      const fileSize = Buffer.isBuffer(document.content) ? document.content.length : Buffer.from(document.content, 'base64').length;
      if (fileSize > config.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed: ${config.maxFileSize} bytes`);
      }

      await this.rateLimitManager.checkRateLimit('ocr-google-vision', requestId);

      const result = await this.retryManager.executeWithRetry(
        () => this.processWithGoogleVision(document, options),
        'ocr-google-vision'
      );

      const processingTime = Date.now() - startTime;
      result.metadata.processingTime = processingTime;

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OCR processing failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async processWithGoogleVision(
    document: OCRDocument,
    options: OCROptions
  ): Promise<OCRResult> {
    if (!this.googleVisionClient) {
      throw new Error('Google Vision client not initialized');
    }

    const base64Content = Buffer.isBuffer(document.content) 
      ? document.content.toString('base64')
      : document.content;

    const requestBody = {
      requests: [{
        image: {
          content: base64Content
        },
        features: [
          {
            type: 'TEXT_DETECTION',
            maxResults: 1000
          }
        ],
        imageContext: {
          languageHints: options.language ? [options.language] : ['vi', 'en']
        }
      }]
    };

    // Add document text detection for better accuracy with documents
    if (document.mimeType === 'application/pdf' || options.extractTables || options.extractForms) {
      requestBody.requests[0].features.push({
        type: 'DOCUMENT_TEXT_DETECTION',
        maxResults: 1000
      });
    }

    const response = await this.googleVisionClient.post('/images:annotate', requestBody);
    
    if (response.data.responses[0].error) {
      throw new Error(`Google Vision API error: ${response.data.responses[0].error.message}`);
    }

    return this.parseGoogleVisionResponse(response.data.responses[0], options);
  }

  private parseGoogleVisionResponse(response: any, options: OCROptions): OCRResult {
    const textAnnotations = response.textAnnotations || [];
    const fullTextAnnotation = response.fullTextAnnotation;
    
    let fullText = '';
    let overallConfidence = 0;
    const blocks: TextBlock[] = [];
    
    if (fullTextAnnotation) {
      fullText = fullTextAnnotation.text || '';
      
      // Process pages
      for (const page of fullTextAnnotation.pages || []) {
        for (const block of page.blocks || []) {
          const blockText = this.extractBlockText(block);
          const blockConfidence = this.calculateBlockConfidence(block);
          
          if (blockConfidence >= (options.confidence || 0.5)) {
            blocks.push({
              text: blockText,
              confidence: blockConfidence,
              boundingBox: this.convertBoundingBox(block.boundingBox),
              words: this.extractWords(block)
            });
          }
        }
      }
      
      overallConfidence = this.calculateOverallConfidence(blocks);
    } else if (textAnnotations.length > 0) {
      // Fallback to basic text annotations
      fullText = textAnnotations[0].description || '';
      overallConfidence = 0.8; // Default confidence for basic detection
      
      blocks.push({
        text: fullText,
        confidence: overallConfidence,
        boundingBox: this.convertBoundingBox(textAnnotations[0].boundingPoly),
        words: []
      });
    }

    // Extract tables if requested
    let tables: TableData[] | undefined;
    if (options.extractTables) {
      tables = this.extractTables(fullTextAnnotation);
    }

    // Extract forms if requested
    let forms: FormData[] | undefined;
    if (options.extractForms) {
      forms = this.extractForms(fullTextAnnotation);
    }

    return {
      text: fullText,
      confidence: overallConfidence,
      blocks,
      tables,
      forms,
      metadata: {
        pageCount: fullTextAnnotation?.pages?.length || 1,
        language: this.detectLanguage(fullText),
        processingTime: 0 // Will be set by caller
      }
    };
  }

  private extractBlockText(block: any): string {
    let text = '';
    for (const paragraph of block.paragraphs || []) {
      for (const word of paragraph.words || []) {
        for (const symbol of word.symbols || []) {
          text += symbol.text || '';
        }
        text += ' ';
      }
      text += '\n';
    }
    return text.trim();
  }

  private calculateBlockConfidence(block: any): number {
    let totalConfidence = 0;
    let symbolCount = 0;
    
    for (const paragraph of block.paragraphs || []) {
      for (const word of paragraph.words || []) {
        for (const symbol of word.symbols || []) {
          if (symbol.confidence !== undefined) {
            totalConfidence += symbol.confidence;
            symbolCount++;
          }
        }
      }
    }
    
    return symbolCount > 0 ? totalConfidence / symbolCount : 0.5;
  }

  private calculateOverallConfidence(blocks: TextBlock[]): number {
    if (blocks.length === 0) return 0;
    
    let totalConfidence = 0;
    let totalLength = 0;
    
    for (const block of blocks) {
      const weight = block.text.length;
      totalConfidence += block.confidence * weight;
      totalLength += weight;
    }
    
    return totalLength > 0 ? totalConfidence / totalLength : 0;
  }

  private convertBoundingBox(boundingPoly: any): BoundingBox {
    if (!boundingPoly || !boundingPoly.vertices) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    const vertices = boundingPoly.vertices;
    const xCoords = vertices.map((v: any) => v.x || 0);
    const yCoords = vertices.map((v: any) => v.y || 0);
    
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private extractWords(block: any): Word[] {
    const words: Word[] = [];
    
    for (const paragraph of block.paragraphs || []) {
      for (const word of paragraph.words || []) {
        let wordText = '';
        let wordConfidence = 0;
        let symbolCount = 0;
        
        for (const symbol of word.symbols || []) {
          wordText += symbol.text || '';
          if (symbol.confidence !== undefined) {
            wordConfidence += symbol.confidence;
            symbolCount++;
          }
        }
        
        if (wordText) {
          words.push({
            text: wordText,
            confidence: symbolCount > 0 ? wordConfidence / symbolCount : 0.5,
            boundingBox: this.convertBoundingBox(word.boundingBox)
          });
        }
      }
    }
    
    return words;
  }

  private extractTables(fullTextAnnotation: any): TableData[] {
    // Simplified table extraction - in a real implementation,
    // this would use more sophisticated layout analysis
    const tables: TableData[] = [];
    
    // This is a placeholder implementation
    // Real table extraction would analyze the spatial relationships
    // between text blocks to identify table structures
    
    return tables;
  }

  private extractForms(fullTextAnnotation: any): FormData[] {
    // Simplified form extraction - in a real implementation,
    // this would use pattern matching to identify form fields
    const forms: FormData[] = [];
    
    // This is a placeholder implementation
    // Real form extraction would look for patterns like:
    // "Label: ___" or "Label: [value]"
    
    return forms;
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    const vietnameseChars = /[àáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳýỵỷỹ]/i;
    
    if (vietnameseChars.test(text)) {
      return 'vi';
    }
    
    return 'en';
  }

  public async extractHealthcareDocument(
    document: OCRDocument,
    documentType: 'medical_record' | 'prescription' | 'invoice' | 'insurance_card' | 'lab_result'
  ): Promise<IntegrationResponse<{
    ocrResult: OCRResult;
    extractedData: Record<string, any>;
    confidence: number;
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      // First, perform OCR
      const ocrResponse = await this.extractText(document, {
        extractTables: documentType === 'lab_result' || documentType === 'invoice',
        extractForms: documentType === 'medical_record' || documentType === 'prescription',
        confidence: 0.7
      });

      if (!ocrResponse.success) {
        throw new Error(ocrResponse.error);
      }

      // Then, extract structured data based on document type
      const extractedData = this.extractStructuredData(ocrResponse.data!, documentType);
      
      return {
        success: true,
        data: {
          ocrResult: ocrResponse.data!,
          extractedData,
          confidence: ocrResponse.data!.confidence
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Healthcare document extraction failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private extractStructuredData(ocrResult: OCRResult, documentType: string): Record<string, any> {
    const text = ocrResult.text;
    const data: Record<string, any> = {};

    switch (documentType) {
      case 'medical_record':
        data.patientName = this.extractField(text, /(?:Họ tên|Patient Name|Name):?\s*([^\n]+)/i);
        data.patientId = this.extractField(text, /(?:Mã BN|Patient ID|ID):?\s*([^\n]+)/i);
        data.diagnosis = this.extractField(text, /(?:Chẩn đoán|Diagnosis):?\s*([^\n]+)/i);
        data.treatment = this.extractField(text, /(?:Điều trị|Treatment):?\s*([^\n]+)/i);
        break;

      case 'prescription':
        data.doctorName = this.extractField(text, /(?:Bác sĩ|Doctor):?\s*([^\n]+)/i);
        data.medications = this.extractMedications(text);
        data.date = this.extractDate(text);
        break;

      case 'invoice':
        data.totalAmount = this.extractAmount(text);
        data.invoiceNumber = this.extractField(text, /(?:Số hóa đơn|Invoice No|Receipt No):?\s*([^\n]+)/i);
        data.date = this.extractDate(text);
        data.items = this.extractInvoiceItems(text, ocrResult.tables);
        break;

      case 'insurance_card':
        data.cardNumber = this.extractField(text, /(?:Số thẻ|Card No):?\s*([^\n]+)/i);
        data.holderName = this.extractField(text, /(?:Họ tên|Name):?\s*([^\n]+)/i);
        data.expiryDate = this.extractDate(text);
        break;

      case 'lab_result':
        data.patientName = this.extractField(text, /(?:Họ tên|Patient Name):?\s*([^\n]+)/i);
        data.testDate = this.extractDate(text);
        data.results = this.extractLabResults(text, ocrResult.tables);
        break;
    }

    return data;
  }

  private extractField(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  private extractDate(text: string): string | null {
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private extractAmount(text: string): number | null {
    const amountPattern = /(?:Tổng cộng|Total|Amount):?\s*([0-9,\.]+)/i;
    const match = text.match(amountPattern);
    if (match) {
      const amount = match[1].replace(/,/g, '');
      return parseFloat(amount);
    }
    return null;
  }

  private extractMedications(text: string): string[] {
    // Look for medication patterns
    const medicationPattern = /(?:Thuốc|Medicine|Drug):?\s*([^\n]+)/gi;
    const medications: string[] = [];
    let match;

    while ((match = medicationPattern.exec(text)) !== null) {
      medications.push(match[1].trim());
    }

    return medications;
  }

  private extractInvoiceItems(text: string, tables?: TableData[]): any[] {
    const items: any[] = [];

    if (tables && tables.length > 0) {
      // Extract from table structure
      const table = tables[0];
      for (let i = 1; i < table.rows.length; i++) { // Skip header row
        const row = table.rows[i];
        if (row.cells.length >= 3) {
          items.push({
            description: row.cells[0].text,
            quantity: parseInt(row.cells[1].text) || 1,
            price: parseFloat(row.cells[2].text.replace(/,/g, '')) || 0
          });
        }
      }
    }

    return items;
  }

  private extractLabResults(text: string, tables?: TableData[]): any[] {
    const results: any[] = [];

    if (tables && tables.length > 0) {
      // Extract from table structure
      const table = tables[0];
      for (let i = 1; i < table.rows.length; i++) { // Skip header row
        const row = table.rows[i];
        if (row.cells.length >= 3) {
          results.push({
            test: row.cells[0].text,
            result: row.cells[1].text,
            referenceRange: row.cells[2].text
          });
        }
      }
    }

    return results;
  }

  public async batchProcessDocuments(
    documents: OCRDocument[],
    options: OCROptions = {}
  ): Promise<IntegrationResponse<OCRResult[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      const results = await Promise.allSettled(
        documents.map(doc => this.extractText(doc, options))
      );

      const successfulResults = results
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .map(result => (result as PromiseFulfilledResult<IntegrationResponse<OCRResult>>).value.data!);

      return {
        success: true,
        data: successfulResults,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch OCR processing failed',
        requestId,
        timestamp: new Date()
      };
    }
  }
}
