import { EventEmitter } from 'events';
import {
  AIModel,
  ClassificationResult,
  ClassificationMetadata,
  DocumentFeatures,
  TrainingData,
  TrainingResult,
  PerformanceMetrics,
  AIComponent,
  ComponentStatus,
  TextFeatures,
  VisualFeatures,
  StructuralFeatures,
  MetadataFeatures,
  NamedEntity
} from '../models/interfaces';

export interface ClassificationTrainingData extends TrainingData {
  input: Buffer; // Document image/PDF buffer
  expectedOutput: {
    documentClass: string;
    confidence: number;
    features: DocumentFeatures;
    metadata: ClassificationMetadata;
  };
  metadata: {
    documentType: string;
    language: string;
    source: string;
    quality: 'high' | 'medium' | 'low';
    annotator: string;
    verificationLevel: 'expert' | 'crowdsourced' | 'automated';
  };
}



export interface ClassificationModel {
  id: string;
  architecture: 'CNN' | 'ResNet' | 'Transformer' | 'Multimodal' | 'Ensemble';
  inputTypes: ('text' | 'image' | 'metadata')[];
  outputClasses: string[];
  hyperparameters: ClassificationHyperparameters;
  featureExtractors: FeatureExtractor[];
}

export interface ClassificationHyperparameters {
  learningRate: number;
  batchSize: number;
  epochs: number;
  dropout: number;
  regularization: number;
  optimizerType: 'adam' | 'sgd' | 'rmsprop';
  lossFunction: 'categorical_crossentropy' | 'focal_loss' | 'weighted_crossentropy';
  classWeights: Record<string, number>;
}

export interface FeatureExtractor {
  name: string;
  type: 'text' | 'visual' | 'structural' | 'metadata';
  enabled: boolean;
  weight: number;
  parameters: Record<string, any>;
}

export interface ClassificationEvaluation {
  accuracy: number;
  precision: Record<string, number>;
  recall: Record<string, number>;
  f1Score: Record<string, number>;
  confusionMatrix: number[][];
  classLabels: string[];
  perClassMetrics: Record<string, ClassMetrics>;
  macroAverage: ClassMetrics;
  weightedAverage: ClassMetrics;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
}

export interface MultimodalFeatures {
  textualEmbedding: number[];
  visualEmbedding: number[];
  structuralVector: number[];
  metadataVector: number[];
  fusedRepresentation: number[];
}

export interface ActiveLearningQuery {
  sampleId: string;
  uncertaintyScore: number;
  queryStrategy: 'uncertainty' | 'diversity' | 'expected_error_reduction';
  features: DocumentFeatures;
  currentPrediction: ClassificationResult;
}

export class DocumentClassifier extends EventEmitter implements AIComponent {
  private models: Map<string, ClassificationModel> = new Map();
  private activeModel: string | null = null;
  private status: ComponentStatus;
  private documentClasses: string[] = [
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
    'consent_form',          // Phiếu đồng ý
    'other'                  // Khác
  ];

  private featureExtractors: Map<string, FeatureExtractor> = new Map();
  private classWeights: Map<string, number> = new Map();
  private activeLearningPool: ActiveLearningQuery[] = [];

  constructor() {
    super();
    this.status = {
      isReady: false,
      isProcessing: false,
      uptime: 0,
      totalProcessed: 0
    };
    this.initializeFeatureExtractors();
    this.initializeClassWeights();
  }

  async initialize(): Promise<void> {
    try {
      this.emit('initialization_started');
      
      // Load pre-trained models
      await this.loadPretrainedModels();
      
      // Initialize feature extraction pipelines
      await this.initializeFeaturePipelines();
      
      // Load Vietnamese healthcare vocabularies
      await this.loadDomainKnowledge();
      
      // Setup multimodal fusion layers
      await this.setupMultimodalFusion();
      
      this.status.isReady = true;
      this.emit('initialization_completed');
      
    } catch (error) {
      this.status.lastError = error.message;
      this.emit('initialization_failed', { error: error.message });
      throw error;
    }
  }

  async process(input: any, options?: any): Promise<any> {
    if (Buffer.isBuffer(input)) {
      return await this.classifyDocument(input, options);
    }
    throw new Error('Invalid input type for DocumentClassifier');
  }

  getStatus(): ComponentStatus {
    return { ...this.status };
  }

  getMetrics(): PerformanceMetrics {
    return {
      inferenceTime: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: 0,
      accuracy: this.calculateAverageAccuracy(),
      precision: 0,
      recall: 0,
      f1Score: 0
    };
  }

  private initializeFeatureExtractors(): void {
    const extractors: FeatureExtractor[] = [
      {
        name: 'vietnamese_healthcare_text',
        type: 'text',
        enabled: true,
        weight: 0.4,
        parameters: {
          vocabulary_size: 50000,
          embedding_dim: 300,
          max_sequence_length: 512,
          use_pretrained: true,
          medical_terminology: true
        }
      },
      {
        name: 'document_layout_cnn',
        type: 'visual',
        enabled: true,
        weight: 0.3,
        parameters: {
          input_size: [224, 224],
          architecture: 'ResNet50',
          pretrained: true,
          fine_tuned: true
        }
      },
      {
        name: 'structural_analyzer',
        type: 'structural',
        enabled: true,
        weight: 0.2,
        parameters: {
          features: ['header_detection', 'table_detection', 'form_fields', 'sections'],
          use_ocr: true,
          layout_analysis: true
        }
      },
      {
        name: 'metadata_encoder',
        type: 'metadata',
        enabled: true,
        weight: 0.1,
        parameters: {
          features: ['file_size', 'page_count', 'creation_date', 'source'],
          normalization: 'min_max',
          categorical_encoding: 'one_hot'
        }
      }
    ];

    extractors.forEach(extractor => {
      this.featureExtractors.set(extractor.name, extractor);
    });
  }

  private initializeClassWeights(): void {
    // Set class weights based on Vietnamese healthcare document frequencies
    const weights = {
      'medical_bill': 1.0,
      'prescription': 1.2,      // Slightly higher weight due to importance
      'lab_result': 1.0,
      'medical_report': 0.8,
      'xray_report': 1.5,       // Higher weight due to rarity
      'insurance_card': 1.0,
      'id_document': 0.7,
      'discharge_summary': 1.3,
      'referral_letter': 1.4,
      'surgery_report': 1.6,    // High weight due to critical nature
      'vaccination_record': 1.1,
      'medical_certificate': 0.9,
      'consent_form': 1.2,
      'other': 0.5              // Lower weight for catch-all category
    };

    Object.entries(weights).forEach(([className, weight]) => {
      this.classWeights.set(className, weight);
    });
  }

  async classifyDocument(
    documentBuffer: Buffer,
    options: {
      extractFeatures?: boolean;
      confidenceThreshold?: number;
      returnTopK?: number;
      enableActiveLearning?: boolean;
    } = {}
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    this.status.isProcessing = true;

    try {
      this.emit('classification_started', { documentSize: documentBuffer.length });

      // Extract multimodal features
      const features = await this.extractMultimodalFeatures(documentBuffer);
      
      // Get prediction from ensemble models
      const prediction = await this.predictWithEnsemble(features, options);
      
      // Apply confidence calibration
      const calibratedPrediction = await this.calibrateConfidence(prediction);
      
      // Check for active learning opportunities
      if (options.enableActiveLearning) {
        await this.checkActiveLearningQuery(features, calibratedPrediction);
      }

      const result: ClassificationResult = {
        primaryClass: calibratedPrediction.primaryClass,
        confidence: calibratedPrediction.confidence,
        allClasses: calibratedPrediction.allClasses,
        features: options.extractFeatures ? features : {} as DocumentFeatures,
        metadata: {
          modelVersion: this.activeModel || 'ensemble_v1',
          featuresUsed: Array.from(this.featureExtractors.keys()),
          processingTime: Date.now() - startTime,
          confidenceThreshold: options.confidenceThreshold || 0.7,
          featureImportance: this.getFeatureImportance()
        }
      };

      this.status.totalProcessed++;
      this.emit('classification_completed', {
        primaryClass: result.primaryClass,
        confidence: result.confidence,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.emit('classification_failed', { error: error.message });
      throw error;
    } finally {
      this.status.isProcessing = false;
    }
  }

  async trainModel(trainingData: ClassificationTrainingData[]): Promise<TrainingResult> {
    this.emit('training_started', { sampleCount: trainingData.length });
    
    try {
      // Validate training data
      await this.validateTrainingData(trainingData);
      
      // Prepare training splits
      const { trainSplit, valSplit, testSplit } = this.splitTrainingData(trainingData);
      
      // Extract features for all samples
      const trainFeatures = await this.extractBatchFeatures(trainSplit);
      const valFeatures = await this.extractBatchFeatures(valSplit);
      
      // Handle class imbalance
      const balancedTrainFeatures = await this.handleClassImbalance(trainFeatures);
      
      // Train multimodal model
      const modelId = `classifier_${Date.now()}`;
      const model = await this.trainMultimodalModel(
        balancedTrainFeatures,
        valFeatures,
        modelId
      );
      
      // Evaluate model
      const testFeatures = await this.extractBatchFeatures(testSplit);
      const evaluation = await this.evaluateModel(model, testFeatures);
      
      // Save model
      await this.saveModel(model, modelId);
      
      const result: TrainingResult = {
        modelId,
        success: true,
        finalAccuracy: evaluation.accuracy,
        trainingHistory: [], // Simplified for this implementation
        modelPath: `/models/classification/${modelId}`,
        metadata: {
          trainingDuration: 0,
          datasetSize: trainingData.length,
          modelComplexity: 0,
          computeResources: {
            cpuHours: 3.2,
            memoryPeakGB: 8.5,
            storageUsedGB: 2.1
          }
        }
      };

      this.emit('training_completed', { modelId, accuracy: evaluation.accuracy });
      return result;

    } catch (error) {
      this.emit('training_failed', { error: error.message });
      throw error;
    }
  }

  private async extractMultimodalFeatures(documentBuffer: Buffer): Promise<DocumentFeatures> {
    this.emit('feature_extraction_started');

    // Extract text features
    const textFeatures = await this.extractTextFeatures(documentBuffer);
    
    // Extract visual features
    const visualFeatures = await this.extractVisualFeatures(documentBuffer);
    
    // Extract structural features
    const structuralFeatures = await this.extractStructuralFeatures(documentBuffer);
    
    // Extract metadata features
    const metadataFeatures = await this.extractMetadataFeatures(documentBuffer);

    const features: DocumentFeatures = {
      textFeatures,
      visualFeatures,
      structuralFeatures,
      metadataFeatures
    };

    this.emit('feature_extraction_completed', {
      textFeatureCount: textFeatures.keywords.length,
      entityCount: textFeatures.entities.length
    });

    return features;
  }

  private async extractTextFeatures(documentBuffer: Buffer): Promise<TextFeatures> {
    // Mock OCR extraction - in real implementation would integrate with OCR service
    const extractedText = await this.performOCR(documentBuffer);
    
    // Vietnamese healthcare keywords
    const healthcareKeywords = [
      'bệnh viện', 'phòng khám', 'hóa đơn', 'viện phí', 'đơn thuốc',
      'xét nghiệm', 'chẩn đoán', 'bác sĩ', 'điều trị', 'thuốc',
      'khám bệnh', 'tái khám', 'nhập viện', 'xuất viện', 'cấp cứu'
    ];

    const foundKeywords = healthcareKeywords.filter(keyword =>
      extractedText.toLowerCase().includes(keyword.toLowerCase())
    );

    // Extract named entities
    const entities = await this.extractNamedEntities(extractedText);
    
    // Calculate text complexity metrics
    const textDensity = extractedText.replace(/\s/g, '').length / extractedText.length;
    const vocabularyComplexity = this.calculateVocabularyComplexity(extractedText);
    const medicalTerminology = this.calculateMedicalTerminologyDensity(extractedText);

    return {
      keywords: foundKeywords,
      entities,
      language: this.detectLanguage(extractedText),
      textDensity,
      vocabularyComplexity,
      medicalTerminology
    };
  }

  private async extractVisualFeatures(documentBuffer: Buffer): Promise<VisualFeatures> {
    // Mock visual feature extraction - would use computer vision in real implementation
    return {
      layout: {
        columnCount: Math.floor(Math.random() * 3) + 1,
        marginSizes: { top: 50, bottom: 50, left: 40, right: 40 },
        fontSizes: [10, 12, 14, 16],
        alignment: 'left',
        hasWatermark: Math.random() > 0.8
      },
      hasLogo: Math.random() > 0.6,
      hasTable: Math.random() > 0.4,
      hasSignature: Math.random() > 0.7,
      hasHandwriting: Math.random() > 0.3,
      colorProfile: ['black', 'white', 'blue'],
      imageQuality: 0.8 + Math.random() * 0.2
    };
  }

  private async extractStructuralFeatures(documentBuffer: Buffer): Promise<StructuralFeatures> {
    // Mock structural analysis
    return {
      hasHeader: Math.random() > 0.3,
      hasFooter: Math.random() > 0.4,
      hasTitle: Math.random() > 0.2,
      sectionCount: Math.floor(Math.random() * 8) + 1,
      paragraphCount: Math.floor(Math.random() * 15) + 3,
      listCount: Math.floor(Math.random() * 5),
      formFieldCount: Math.floor(Math.random() * 10)
    };
  }

  private async extractMetadataFeatures(documentBuffer: Buffer): Promise<MetadataFeatures> {
    return {
      fileSize: documentBuffer.length,
      pageCount: 1, // Simplified
      hasFormFields: Math.random() > 0.5,
      isScanned: Math.random() > 0.6,
      compressionLevel: Math.floor(Math.random() * 10),
      colorDepth: 24
    };
  }

  private async predictWithEnsemble(
    features: DocumentFeatures,
    options: any
  ): Promise<ClassificationResult> {
    // Ensemble prediction combining multiple models/approaches
    const predictions: ClassificationResult[] = [];
    
    // Rule-based classifier (fast, interpretable)
    const ruleBasedPrediction = await this.ruleBasedClassification(features);
    predictions.push(ruleBasedPrediction);
    
    // ML-based classifier (accurate)
    const mlPrediction = await this.mlBasedClassification(features);
    predictions.push(mlPrediction);
    
    // Deep learning classifier (comprehensive)
    const dlPrediction = await this.deepLearningClassification(features);
    predictions.push(dlPrediction);
    
    // Ensemble fusion
    return await this.fuseEnsemblePredictions(predictions, [0.2, 0.4, 0.4]);
  }

  private async ruleBasedClassification(features: DocumentFeatures): Promise<ClassificationResult> {
    const scores = new Map<string, number>();
    
    // Initialize all classes with base score
    this.documentClasses.forEach(className => scores.set(className, 0.1));
    
    // Apply domain-specific rules
    const keywords = features.textFeatures.keywords;
    const entities = features.textFeatures.entities;
    
    // Medical bill rules
    if (keywords.includes('hóa đơn') || keywords.includes('viện phí')) {
      scores.set('medical_bill', scores.get('medical_bill')! + 0.4);
    }
    
    // Prescription rules
    if (keywords.includes('đơn thuốc') || keywords.includes('thuốc')) {
      scores.set('prescription', scores.get('prescription')! + 0.4);
    }
    
    // Lab result rules
    if (keywords.includes('x��t nghiệm') || features.visualFeatures.hasTable) {
      scores.set('lab_result', scores.get('lab_result')! + 0.3);
    }
    
    // Money entities boost medical bill probability
    const hasMoneyEntity = entities.some(e => e.type === 'MONEY');
    if (hasMoneyEntity) {
      scores.set('medical_bill', scores.get('medical_bill')! + 0.2);
    }
    
    // Convert to sorted classification scores
    const allClasses = Array.from(scores.entries())
      .map(([className, score]) => ({
        className,
        confidence: Math.min(score, 0.99),
        probability: score
      }))
      .sort((a, b) => b.confidence - a.confidence);
    
    return {
      primaryClass: allClasses[0].className,
      confidence: allClasses[0].confidence,
      allClasses,
      features,
      metadata: {
        modelVersion: 'rule_based_v1',
        featuresUsed: ['keywords', 'entities', 'visual'],
        processingTime: 50,
        confidenceThreshold: 0.7,
        featureImportance: {
          keywords: 0.5,
          entities: 0.3,
          visual: 0.2
        }
      }
    };
  }

  private async mlBasedClassification(features: DocumentFeatures): Promise<ClassificationResult> {
    // Mock ML model prediction - would use trained model in real implementation
    const featureVector = this.featuresToVector(features);
    
    // Simulate trained model weights and bias
    const modelWeights = this.getMLModelWeights();
    const prediction = this.computeMLPrediction(featureVector, modelWeights);
    
    return prediction;
  }

  private async deepLearningClassification(features: DocumentFeatures): Promise<ClassificationResult> {
    // Mock deep learning prediction - would use neural network in real implementation
    const multimodalEmbedding = await this.createMultimodalEmbedding(features);
    const prediction = await this.computeDLPrediction(multimodalEmbedding);
    
    return prediction;
  }

  private async fuseEnsemblePredictions(
    predictions: ClassificationResult[],
    weights: number[]
  ): Promise<ClassificationResult> {
    const fusedScores = new Map<string, number>();
    
    // Initialize scores
    this.documentClasses.forEach(className => fusedScores.set(className, 0));
    
    // Weighted fusion
    predictions.forEach((prediction, index) => {
      const weight = weights[index];
      prediction.allClasses.forEach(classScore => {
        const currentScore = fusedScores.get(classScore.className) || 0;
        fusedScores.set(classScore.className, currentScore + (classScore.confidence * weight));
      });
    });
    
    // Normalize and sort
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const allClasses = Array.from(fusedScores.entries())
      .map(([className, score]) => ({
        className,
        confidence: score / totalWeight,
        probability: score / totalWeight
      }))
      .sort((a, b) => b.confidence - a.confidence);
    
    return {
      primaryClass: allClasses[0].className,
      confidence: allClasses[0].confidence,
      allClasses,
      features: predictions[0].features,
      metadata: {
        modelVersion: 'ensemble_v1',
        featuresUsed: ['rule_based', 'ml_model', 'deep_learning'],
        processingTime: 200,
        confidenceThreshold: 0.7,
        featureImportance: this.getFeatureImportance()
      }
    };
  }

  private async calibrateConfidence(prediction: ClassificationResult): Promise<ClassificationResult> {
    // Apply Platt scaling or isotonic regression for confidence calibration
    const calibratedClasses = prediction.allClasses.map(classScore => ({
      ...classScore,
      confidence: this.applyPlattScaling(classScore.confidence, classScore.className)
    }));
    
    return {
      ...prediction,
      confidence: calibratedClasses[0].confidence,
      allClasses: calibratedClasses
    };
  }

  private applyPlattScaling(rawScore: number, className: string): number {
    // Mock Platt scaling parameters - would be learned from validation data
    const A = -1.2; // Sigmoid slope
    const B = 0.3;  // Sigmoid intercept
    
    const calibratedScore = 1 / (1 + Math.exp(A * rawScore + B));
    return Math.max(0.01, Math.min(0.99, calibratedScore));
  }

  private async checkActiveLearningQuery(
    features: DocumentFeatures,
    prediction: ClassificationResult
  ): Promise<void> {
    const uncertaintyScore = this.calculateUncertaintyScore(prediction);
    
    if (uncertaintyScore > 0.7) { // High uncertainty threshold
      const query: ActiveLearningQuery = {
        sampleId: `sample_${Date.now()}`,
        uncertaintyScore,
        queryStrategy: 'uncertainty',
        features,
        currentPrediction: prediction
      };
      
      this.activeLearningPool.push(query);
      this.emit('active_learning_query', { query });
    }
  }

  private calculateUncertaintyScore(prediction: ClassificationResult): number {
    // Calculate entropy-based uncertainty
    const probabilities = prediction.allClasses.map(c => c.probability);
    const entropy = -probabilities.reduce((sum, p) => sum + p * Math.log2(p + 1e-10), 0);
    const maxEntropy = Math.log2(this.documentClasses.length);
    return entropy / maxEntropy;
  }

  // Helper methods
  private async performOCR(documentBuffer: Buffer): Promise<string> {
    // Mock OCR - would integrate with actual OCR service
    const mockTexts = [
      'BỆNH VIỆN BẠCH MAI\nHÓA ĐƠN VIỆN PHÍ\nBệnh nhân: Nguyễn Văn A\nTổng tiền: 2.500.000 VNĐ',
      'ĐƠN THUỐC\nBác sĩ: Trần Thị B\nThuốc: Augmentin 625mg',
      'KẾT QUẢ XÉT NGHIỆM\nHemoglobin: 12.5 g/dL'
    ];
    return mockTexts[Math.floor(Math.random() * mockTexts.length)];
  }

  private async extractNamedEntities(text: string): Promise<NamedEntity[]> {
    // Mock NER - would use trained NER model
    const entities: NamedEntity[] = [];
    
    // Simple pattern matching for Vietnamese names
    const namePattern = /(?:bệnh nhân|bn)[\s:]*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲ��ỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/gi;
    
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      entities.push({
        text: match[1],
        type: 'PERSON',
        confidence: 0.85,
        position: { start: match.index, end: match.index + match[0].length, line: 0, column: 0 },
        attributes: {}
      });
    }
    
    return entities;
  }

  private detectLanguage(text: string): string {
    const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    return vietnameseChars.test(text) ? 'vietnamese' : 'english';
  }

  private calculateVocabularyComplexity(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    return uniqueWords.size / words.length;
  }

  private calculateMedicalTerminologyDensity(text: string): number {
    const medicalTerms = [
      'hemoglobin', 'glucose', 'cholesterol', 'creatinine', 'albumin',
      'bilirubin', 'triglyceride', 'ast', 'alt', 'ggt'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    const medicalCount = words.filter(word => 
      medicalTerms.some(term => word.includes(term))
    ).length;
    
    return medicalCount / words.length;
  }

  private featuresToVector(features: DocumentFeatures): number[] {
    const vector: number[] = [];
    
    // Text features
    vector.push(features.textFeatures.keywords.length / 10);
    vector.push(features.textFeatures.entities.length / 20);
    vector.push(features.textFeatures.textDensity);
    vector.push(features.textFeatures.vocabularyComplexity);
    vector.push(features.textFeatures.medicalTerminology);
    
    // Visual features
    vector.push(features.visualFeatures.layout.columnCount / 3);
    vector.push(features.visualFeatures.hasLogo ? 1 : 0);
    vector.push(features.visualFeatures.hasTable ? 1 : 0);
    vector.push(features.visualFeatures.hasSignature ? 1 : 0);
    vector.push(features.visualFeatures.imageQuality);
    
    // Structural features
    vector.push(features.structuralFeatures.hasHeader ? 1 : 0);
    vector.push(features.structuralFeatures.sectionCount / 10);
    vector.push(features.structuralFeatures.paragraphCount / 20);
    vector.push(features.structuralFeatures.formFieldCount / 10);
    
    // Metadata features
    vector.push(Math.min(features.metadataFeatures.fileSize / 1000000, 1));
    vector.push(features.metadataFeatures.pageCount / 10);
    vector.push(features.metadataFeatures.isScanned ? 1 : 0);
    
    return vector;
  }

  private getMLModelWeights(): number[][] {
    // Mock trained weights - would load from actual model
    return Array.from({ length: this.documentClasses.length }, () =>
      Array.from({ length: 17 }, () => Math.random() * 2 - 1)
    );
  }

  private computeMLPrediction(featureVector: number[], weights: number[][]): ClassificationResult {
    const scores = weights.map(classWeights => {
      return classWeights.reduce((sum, weight, index) => 
        sum + weight * (featureVector[index] || 0), 0
      );
    });
    
    // Apply softmax
    const expScores = scores.map(score => Math.exp(score - Math.max(...scores)));
    const sumExp = expScores.reduce((sum, exp) => sum + exp, 0);
    const probabilities = expScores.map(exp => exp / sumExp);
    
    const allClasses = this.documentClasses.map((className, index) => ({
      className,
      confidence: probabilities[index],
      probability: probabilities[index]
    })).sort((a, b) => b.confidence - a.confidence);
    
    return {
      primaryClass: allClasses[0].className,
      confidence: allClasses[0].confidence,
      allClasses,
      features: {} as DocumentFeatures,
      metadata: {
        modelVersion: 'ml_v1',
        featuresUsed: ['all'],
        processingTime: 100,
        confidenceThreshold: 0.7,
        featureImportance: {}
      }
    };
  }

  private async createMultimodalEmbedding(features: DocumentFeatures): Promise<number[]> {
    // Mock multimodal embedding - would use actual fusion network
    const textEmbedding = Array.from({ length: 128 }, () => Math.random() - 0.5);
    const visualEmbedding = Array.from({ length: 128 }, () => Math.random() - 0.5);
    const structuralEmbedding = Array.from({ length: 64 }, () => Math.random() - 0.5);
    
    return [...textEmbedding, ...visualEmbedding, ...structuralEmbedding];
  }

  private async computeDLPrediction(embedding: number[]): Promise<ClassificationResult> {
    // Mock deep learning prediction
    const scores = Array.from({ length: this.documentClasses.length }, () => Math.random());
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const probabilities = scores.map(score => score / totalScore);
    
    const allClasses = this.documentClasses.map((className, index) => ({
      className,
      confidence: probabilities[index],
      probability: probabilities[index]
    })).sort((a, b) => b.confidence - a.confidence);
    
    return {
      primaryClass: allClasses[0].className,
      confidence: allClasses[0].confidence,
      allClasses,
      features: {} as DocumentFeatures,
      metadata: {
        modelVersion: 'dl_v1',
        featuresUsed: ['multimodal'],
        processingTime: 300,
        confidenceThreshold: 0.7,
        featureImportance: {}
      }
    };
  }

  private getFeatureImportance(): Record<string, number> {
    return {
      text_keywords: 0.25,
      visual_layout: 0.20,
      structural_elements: 0.20,
      named_entities: 0.15,
      metadata: 0.10,
      medical_terminology: 0.10
    };
  }

  private calculateAverageAccuracy(): number {
    // Mock calculation
    return 0.923;
  }

  // Training helper methods
  private async validateTrainingData(data: ClassificationTrainingData[]): Promise<void> {
    if (data.length < 500) {
      throw new Error('Insufficient training data. Need at least 500 samples for classification.');
    }
    
    // Check class distribution
    const classDistribution = new Map<string, number>();
    data.forEach(sample => {
      const className = sample.expectedOutput.documentClass;
      classDistribution.set(className, (classDistribution.get(className) || 0) + 1);
    });
    
    // Ensure all classes have minimum samples
    this.documentClasses.forEach(className => {
      const count = classDistribution.get(className) || 0;
      if (count < 20) {
        console.warn(`Class ${className} has only ${count} samples. Consider collecting more data.`);
      }
    });
  }

  private splitTrainingData(data: ClassificationTrainingData[]): {
    trainSplit: ClassificationTrainingData[];
    valSplit: ClassificationTrainingData[];
    testSplit: ClassificationTrainingData[];
  } {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const trainSize = Math.floor(shuffled.length * 0.7);
    const valSize = Math.floor(shuffled.length * 0.15);
    
    return {
      trainSplit: shuffled.slice(0, trainSize),
      valSplit: shuffled.slice(trainSize, trainSize + valSize),
      testSplit: shuffled.slice(trainSize + valSize)
    };
  }

  private async extractBatchFeatures(data: ClassificationTrainingData[]): Promise<Array<{
    features: DocumentFeatures;
    label: string;
  }>> {
    return Promise.all(data.map(async sample => ({
      features: await this.extractMultimodalFeatures(sample.input),
      label: sample.expectedOutput.documentClass
    })));
  }

  private async handleClassImbalance(trainFeatures: Array<{
    features: DocumentFeatures;
    label: string;
  }>): Promise<Array<{
    features: DocumentFeatures;
    label: string;
  }>> {
    // Implement SMOTE or other oversampling techniques
    // For now, return as-is
    return trainFeatures;
  }

  private async trainMultimodalModel(
    trainFeatures: Array<{ features: DocumentFeatures; label: string }>,
    valFeatures: Array<{ features: DocumentFeatures; label: string }>,
    modelId: string
  ): Promise<ClassificationModel> {
    // Mock model training
    const model: ClassificationModel = {
      id: modelId,
      architecture: 'Multimodal',
      inputTypes: ['text', 'image', 'metadata'],
      outputClasses: this.documentClasses,
      hyperparameters: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 50,
        dropout: 0.2,
        regularization: 0.01,
        optimizerType: 'adam',
        lossFunction: 'categorical_crossentropy',
        classWeights: Object.fromEntries(this.classWeights)
      },
      featureExtractors: Array.from(this.featureExtractors.values())
    };
    
    this.models.set(modelId, model);
    return model;
  }

  private async evaluateModel(
    model: ClassificationModel,
    testFeatures: Array<{ features: DocumentFeatures; label: string }>
  ): Promise<ClassificationEvaluation> {
    // Mock evaluation - would run actual inference
    return {
      accuracy: 0.923,
      precision: Object.fromEntries(this.documentClasses.map(c => [c, 0.9 + Math.random() * 0.1])),
      recall: Object.fromEntries(this.documentClasses.map(c => [c, 0.9 + Math.random() * 0.1])),
      f1Score: Object.fromEntries(this.documentClasses.map(c => [c, 0.9 + Math.random() * 0.1])),
      confusionMatrix: Array.from({ length: this.documentClasses.length }, () =>
        Array.from({ length: this.documentClasses.length }, () => Math.floor(Math.random() * 10))
      ),
      classLabels: this.documentClasses,
      perClassMetrics: Object.fromEntries(this.documentClasses.map(c => [c, {
        precision: 0.9 + Math.random() * 0.1,
        recall: 0.9 + Math.random() * 0.1,
        f1Score: 0.9 + Math.random() * 0.1,
        support: Math.floor(Math.random() * 50) + 10
      }])),
      macroAverage: {
        precision: 0.923,
        recall: 0.921,
        f1Score: 0.922,
        support: testFeatures.length
      },
      weightedAverage: {
        precision: 0.925,
        recall: 0.923,
        f1Score: 0.924,
        support: testFeatures.length
      }
    };
  }

  private async saveModel(model: ClassificationModel, modelId: string): Promise<void> {
    // Mock model saving
    this.emit('model_saved', { modelId });
  }

  private async loadPretrainedModels(): Promise<void> {
    // Mock loading pretrained models
    this.emit('pretrained_models_loaded');
  }

  private async initializeFeaturePipelines(): Promise<void> {
    // Mock feature pipeline initialization
    this.emit('feature_pipelines_initialized');
  }

  private async loadDomainKnowledge(): Promise<void> {
    // Mock domain knowledge loading
    this.emit('domain_knowledge_loaded');
  }

  private async setupMultimodalFusion(): Promise<void> {
    // Mock multimodal fusion setup
    this.emit('multimodal_fusion_ready');
  }

  // Public API methods
  getDocumentClasses(): string[] {
    return [...this.documentClasses];
  }

  getActiveLearningQueries(): ActiveLearningQuery[] {
    return [...this.activeLearningPool];
  }

  async labelActiveLearningQuery(sampleId: string, label: string): Promise<void> {
    const queryIndex = this.activeLearningPool.findIndex(q => q.sampleId === sampleId);
    if (queryIndex !== -1) {
      this.activeLearningPool.splice(queryIndex, 1);
      this.emit('active_learning_labeled', { sampleId, label });
    }
  }

  setActiveModel(modelId: string): void {
    if (this.models.has(modelId)) {
      this.activeModel = modelId;
      this.emit('active_model_changed', { modelId });
    }
  }

  getActiveModel(): string | null {
    return this.activeModel;
  }
}
