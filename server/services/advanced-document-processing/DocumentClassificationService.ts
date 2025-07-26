import { EventEmitter } from 'events';

export interface ClassificationResult {
  primaryClass: string;
  confidence: number;
  allClasses: ClassificationScore[];
  features: ExtractedFeatures;
  metadata: {
    processingTime: number;
    modelVersion: string;
    confidence_threshold: number;
  };
}

export interface ClassificationScore {
  className: string;
  confidence: number;
  probability: number;
}

export interface ExtractedFeatures {
  textFeatures: {
    keywords: string[];
    entities: NamedEntity[];
    documentStructure: DocumentStructure;
    language: string;
    textDensity: number;
  };
  visualFeatures: {
    layout: LayoutFeatures;
    hasLogo: boolean;
    hasTable: boolean;
    hasSignature: boolean;
    colorProfile: string[];
  };
  metadataFeatures: {
    fileSize: number;
    pageCount: number;
    hasFormFields: boolean;
    isScanned: boolean;
  };
}

export interface NamedEntity {
  text: string;
  type: 'PERSON' | 'ORG' | 'DATE' | 'MONEY' | 'MEDICAL_CODE' | 'PROCEDURE' | 'MEDICATION' | 'DIAGNOSIS';
  confidence: number;
  position: { start: number; end: number };
}

export interface DocumentStructure {
  hasHeader: boolean;
  hasFooter: boolean;
  hasTitle: boolean;
  sectionCount: number;
  paragraphCount: number;
  listCount: number;
}

export interface LayoutFeatures {
  columnCount: number;
  marginSizes: { top: number; bottom: number; left: number; right: number };
  fontSizes: number[];
  alignment: 'left' | 'center' | 'right' | 'justified' | 'mixed';
}

export interface TrainingData {
  documentId: string;
  features: ExtractedFeatures;
  trueClass: string;
  timestamp: Date;
}

export class DocumentClassificationService extends EventEmitter {
  private readonly documentClasses = [
    'medical_bill',           // Hóa đơn viện phí
    'prescription',           // Đơn thuốc
    'lab_result',            // Kết quả xét nghiệm
    'medical_report',        // Báo cáo y tế
    'xray_report',           // Báo cáo X-quang
    'insurance_card',        // Thẻ bảo hiểm
    'id_document',           // Giấy tờ tùy thân
    'discharge_summary',     // Tóm tắt xuất viện
    'referral_letter',       // Giấy chuyển viện
    'surgery_report',        // Báo cáo phẫu thuật
    'vaccination_record',    // Phiếu tiêm chủng
    'medical_certificate',   // Giấy chứng nhận y tế
    'other'                  // Khác
  ];

  private modelWeights: Map<string, number[]> = new Map();
  private featureImportance: Map<string, number> = new Map();
  private trainingData: TrainingData[] = [];
  private modelVersion = '1.0.0';
  private confidenceThreshold = 0.7;

  constructor() {
    super();
    this.initializeModel();
  }

  private initializeModel(): void {
    // Initialize with pre-trained weights for Vietnamese healthcare documents
    this.documentClasses.forEach(docClass => {
      // Mock pre-trained weights - in real implementation would load from file
      const weights = Array.from({ length: 50 }, () => Math.random() * 2 - 1);
      this.modelWeights.set(docClass, weights);
    });

    // Feature importance scores
    this.featureImportance.set('hospital_keywords', 0.25);
    this.featureImportance.set('medical_entities', 0.20);
    this.featureImportance.set('document_structure', 0.15);
    this.featureImportance.set('layout_features', 0.15);
    this.featureImportance.set('numerical_patterns', 0.10);
    this.featureImportance.set('date_patterns', 0.10);
    this.featureImportance.set('signature_detection', 0.05);
  }

  async classifyDocument(
    documentBuffer: Buffer,
    ocrText: string,
    metadata: any = {}
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      // Extract features from document
      const features = await this.extractFeatures(documentBuffer, ocrText, metadata);
      
      // Run classification model
      const classificationScores = await this.runClassificationModel(features);
      
      // Get primary classification
      const sortedScores = classificationScores.sort((a, b) => b.confidence - a.confidence);
      const primaryClass = sortedScores[0];

      const result: ClassificationResult = {
        primaryClass: primaryClass.className,
        confidence: primaryClass.confidence,
        allClasses: sortedScores,
        features,
        metadata: {
          processingTime: Date.now() - startTime,
          modelVersion: this.modelVersion,
          confidence_threshold: this.confidenceThreshold
        }
      };

      this.emit('documentClassified', {
        documentClass: result.primaryClass,
        confidence: result.confidence,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.emit('classificationError', { error: error.message });
      throw new Error(`Document classification failed: ${error.message}`);
    }
  }

  private async extractFeatures(
    documentBuffer: Buffer,
    ocrText: string,
    metadata: any
  ): Promise<ExtractedFeatures> {
    
    // Extract text features
    const textFeatures = await this.extractTextFeatures(ocrText);
    
    // Extract visual features
    const visualFeatures = await this.extractVisualFeatures(documentBuffer);
    
    // Extract metadata features
    const metadataFeatures = this.extractMetadataFeatures(metadata);

    return {
      textFeatures,
      visualFeatures,
      metadataFeatures
    };
  }

  private async extractTextFeatures(ocrText: string): Promise<ExtractedFeatures['textFeatures']> {
    // Keywords specific to Vietnamese healthcare documents
    const healthcareKeywords = [
      'bệnh viện', 'phòng khám', 'hóa đơn', 'viện phí', 'đơn thuốc', 'toa thuốc',
      'xét nghiệm', 'chẩn đoán', 'khám bệnh', 'điều trị', 'thuốc', 'bác sĩ',
      'y tá', 'bệnh nhân', 'triệu chứng', 'kê đơn', 'tái khám', 'xuất viện',
      'nhập viện', 'phẫu thuật', 'gây mê', 'hồi sức', 'cấp cứu', 'nội trú',
      'ngoại trú', 'BHYT', 'bảo hiểm', 'viện phí', 'chi phí', 'thanh toán'
    ];

    const foundKeywords = healthcareKeywords.filter(keyword => 
      ocrText.toLowerCase().includes(keyword.toLowerCase())
    );

    // Extract named entities
    const entities = await this.extractNamedEntities(ocrText);
    
    // Analyze document structure
    const documentStructure = this.analyzeDocumentStructure(ocrText);
    
    // Detect language
    const language = this.detectLanguage(ocrText);
    
    // Calculate text density
    const textDensity = ocrText.replace(/\s/g, '').length / ocrText.length;

    return {
      keywords: foundKeywords,
      entities,
      documentStructure,
      language,
      textDensity
    };
  }

  private async extractNamedEntities(text: string): Promise<NamedEntity[]> {
    const entities: NamedEntity[] = [];
    
    // Vietnamese person name patterns
    const personPatterns = [
      /(?:bệnh nhân|bn|bác sĩ|bs|ths\.bs|pgs\.ts|gs\.ts)[\s:]*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/gi
    ];

    // Date patterns
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/g,
      /\d{1,2}-\d{1,2}-\d{4}/g,
      /ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}/gi
    ];

    // Money patterns
    const moneyPatterns = [
      /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*(?:vnđ|vnd|đồng)/gi,
      /\d+[.,]\d+\s*(?:vnđ|vnd|đồng)/gi
    ];

    // Medical code patterns
    const medicalCodePatterns = [
      /[A-Z]\d{2}[.-]?[A-Z]?\d*/g, // ICD codes
      /\b\d{6,}\b/g // Medical record numbers
    ];

    // Extract person names
    personPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1].trim(),
          type: 'PERSON',
          confidence: 0.85,
          position: { start: match.index, end: match.index + match[0].length }
        });
      }
    });

    // Extract dates
    datePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: 'DATE',
          confidence: 0.90,
          position: { start: match.index, end: match.index + match[0].length }
        });
      }
    });

    // Extract money amounts
    moneyPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: 'MONEY',
          confidence: 0.92,
          position: { start: match.index, end: match.index + match[0].length }
        });
      }
    });

    // Extract medical codes
    medicalCodePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: 'MEDICAL_CODE',
          confidence: 0.75,
          position: { start: match.index, end: match.index + match[0].length }
        });
      }
    });

    return entities;
  }

  private analyzeDocumentStructure(text: string): DocumentStructure {
    const lines = text.split('\n').filter(line => line.trim());
    
    // Check for header (first few lines contain common header patterns)
    const hasHeader = lines.slice(0, 3).some(line => 
      /(?:bệnh viện|phòng khám|trung tâm|công ty)/i.test(line)
    );

    // Check for title (short line followed by content)
    const hasTitle = lines.some((line, index) => 
      index < 5 && line.length < 50 && /(?:hóa đơn|đơn thuốc|kết quả|báo cáo)/i.test(line)
    );

    // Count sections (lines that look like headers)
    const sectionCount = lines.filter(line => 
      line.length < 100 && /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(line)
    ).length;

    // Count paragraphs
    const paragraphCount = text.split(/\n\s*\n/).length;

    // Count lists (lines starting with numbers or bullets)
    const listCount = lines.filter(line => 
      /^\s*(?:\d+[.)]|\*|-|•)/.test(line)
    ).length;

    return {
      hasHeader,
      hasFooter: false, // Simple detection
      hasTitle,
      sectionCount,
      paragraphCount,
      listCount
    };
  }

  private detectLanguage(text: string): string {
    // Vietnamese-specific character detection
    const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    
    if (vietnameseChars.test(text)) {
      return 'vietnamese';
    }
    
    // English detection
    if (/^[a-zA-Z\s.,!?0-9]+$/.test(text.replace(/\s+/g, ' ').trim())) {
      return 'english';
    }
    
    return 'unknown';
  }

  private async extractVisualFeatures(documentBuffer: Buffer): Promise<ExtractedFeatures['visualFeatures']> {
    // Mock visual feature extraction - in real implementation would analyze image
    return {
      layout: {
        columnCount: Math.floor(Math.random() * 3) + 1,
        marginSizes: { top: 50, bottom: 50, left: 40, right: 40 },
        fontSizes: [10, 12, 14, 16],
        alignment: 'left'
      },
      hasLogo: Math.random() > 0.7,
      hasTable: Math.random() > 0.5,
      hasSignature: Math.random() > 0.6,
      colorProfile: ['black', 'white', 'blue']
    };
  }

  private extractMetadataFeatures(metadata: any): ExtractedFeatures['metadataFeatures'] {
    return {
      fileSize: metadata.size || 0,
      pageCount: metadata.pageCount || 1,
      hasFormFields: metadata.hasFormFields || false,
      isScanned: metadata.isScanned || true
    };
  }

  private async runClassificationModel(features: ExtractedFeatures): Promise<ClassificationScore[]> {
    const scores: ClassificationScore[] = [];
    
    // Convert features to feature vector
    const featureVector = this.featuresToVector(features);
    
    // Calculate score for each document class
    for (const docClass of this.documentClasses) {
      const weights = this.modelWeights.get(docClass) || [];
      let score = 0;
      
      // Simple linear model: score = sum(weights * features)
      for (let i = 0; i < Math.min(weights.length, featureVector.length); i++) {
        score += weights[i] * featureVector[i];
      }
      
      // Apply sigmoid to get probability
      const probability = 1 / (1 + Math.exp(-score));
      
      // Apply class-specific adjustments based on Vietnamese healthcare patterns
      const adjustedConfidence = this.applyDomainKnowledge(docClass, features, probability);
      
      scores.push({
        className: docClass,
        confidence: adjustedConfidence,
        probability
      });
    }
    
    // Normalize scores
    const totalConfidence = scores.reduce((sum, s) => sum + s.confidence, 0);
    scores.forEach(score => {
      score.confidence = score.confidence / totalConfidence;
    });
    
    return scores;
  }

  private featuresToVector(features: ExtractedFeatures): number[] {
    const vector: number[] = [];
    
    // Text features
    vector.push(features.textFeatures.keywords.length / 10); // Normalized keyword count
    vector.push(features.textFeatures.entities.length / 20); // Normalized entity count
    vector.push(features.textFeatures.textDensity);
    vector.push(features.textFeatures.documentStructure.hasHeader ? 1 : 0);
    vector.push(features.textFeatures.documentStructure.hasTitle ? 1 : 0);
    vector.push(features.textFeatures.documentStructure.sectionCount / 10);
    
    // Entity type counts
    const entityTypes = ['PERSON', 'DATE', 'MONEY', 'MEDICAL_CODE'];
    entityTypes.forEach(type => {
      const count = features.textFeatures.entities.filter(e => e.type === type).length;
      vector.push(count / 5); // Normalized
    });
    
    // Visual features
    vector.push(features.visualFeatures.layout.columnCount / 3);
    vector.push(features.visualFeatures.hasLogo ? 1 : 0);
    vector.push(features.visualFeatures.hasTable ? 1 : 0);
    vector.push(features.visualFeatures.hasSignature ? 1 : 0);
    
    // Metadata features
    vector.push(Math.min(features.metadataFeatures.fileSize / 1000000, 1)); // Normalized file size
    vector.push(features.metadataFeatures.pageCount / 10);
    vector.push(features.metadataFeatures.hasFormFields ? 1 : 0);
    vector.push(features.metadataFeatures.isScanned ? 1 : 0);
    
    // Pad with zeros if needed
    while (vector.length < 50) {
      vector.push(0);
    }
    
    return vector.slice(0, 50);
  }

  private applyDomainKnowledge(
    docClass: string,
    features: ExtractedFeatures,
    baseScore: number
  ): number {
    let adjustment = 1.0;
    
    // Apply Vietnamese healthcare document rules
    const keywords = features.textFeatures.keywords;
    const entities = features.textFeatures.entities;
    
    switch (docClass) {
      case 'medical_bill':
        if (keywords.includes('hóa đơn') || keywords.includes('viện phí')) adjustment *= 1.5;
        if (entities.some(e => e.type === 'MONEY')) adjustment *= 1.3;
        break;
        
      case 'prescription':
        if (keywords.includes('đơn thuốc') || keywords.includes('toa thuốc')) adjustment *= 1.5;
        if (keywords.includes('bác sĩ')) adjustment *= 1.2;
        break;
        
      case 'lab_result':
        if (keywords.includes('xét nghiệm') || keywords.includes('kết quả')) adjustment *= 1.4;
        if (features.visualFeatures.hasTable) adjustment *= 1.3;
        break;
        
      case 'medical_report':
        if (keywords.includes('báo cáo') || keywords.includes('chẩn đoán')) adjustment *= 1.4;
        if (features.textFeatures.documentStructure.sectionCount > 3) adjustment *= 1.2;
        break;
        
      case 'insurance_card':
        if (keywords.includes('bảo hiểm') || keywords.includes('BHYT')) adjustment *= 1.6;
        if (features.visualFeatures.hasLogo) adjustment *= 1.2;
        break;
    }
    
    return Math.min(baseScore * adjustment, 0.99);
  }

  // Training methods
  async addTrainingData(
    documentId: string,
    features: ExtractedFeatures,
    trueClass: string
  ): Promise<void> {
    this.trainingData.push({
      documentId,
      features,
      trueClass,
      timestamp: new Date()
    });
    
    this.emit('trainingDataAdded', { documentId, trueClass });
  }

  async retrainModel(): Promise<void> {
    if (this.trainingData.length < 100) {
      throw new Error('Insufficient training data. Need at least 100 samples.');
    }
    
    // Mock model retraining - in real implementation would use ML framework
    this.modelVersion = `1.${Date.now()}`;
    
    this.emit('modelRetrained', {
      version: this.modelVersion,
      trainingDataSize: this.trainingData.length
    });
  }

  // Batch processing
  async classifyBatch(
    documents: Array<{ buffer: Buffer; ocrText: string; metadata?: any }>
  ): Promise<ClassificationResult[]> {
    const results = await Promise.all(
      documents.map(doc => this.classifyDocument(doc.buffer, doc.ocrText, doc.metadata))
    );
    
    this.emit('batchClassificationCompleted', {
      totalDocuments: documents.length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    });
    
    return results;
  }

  // Get model information
  getModelInfo(): any {
    return {
      version: this.modelVersion,
      supportedClasses: this.documentClasses,
      confidenceThreshold: this.confidenceThreshold,
      trainingDataSize: this.trainingData.length,
      featureImportance: Object.fromEntries(this.featureImportance)
    };
  }

  // Update confidence threshold
  setConfidenceThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    this.confidenceThreshold = threshold;
  }
}
