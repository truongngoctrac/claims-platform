import { EventEmitter } from 'events';
import {
  AIModel,
  TrainingRequest,
  TrainingResult,
  TrainingData,
  TrainingOptions,
  PerformanceMetrics,
  OCRResult,
  ModelStatus,
  AIComponent,
  ComponentStatus
} from '../models/interfaces';

export interface OCRTrainingData extends TrainingData {
  input: Buffer; // Image buffer
  expectedOutput: {
    text: string;
    words: Array<{
      text: string;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>;
    language: string;
    confidence: number;
  };
  metadata: {
    imageType: 'scanned' | 'photo' | 'generated';
    quality: 'high' | 'medium' | 'low';
    language: string;
    documentType: string;
    hasHandwriting: boolean;
    noiseLevel: number;
    augmentation?: string;
    augmentationParams?: any;
  };
}

export interface OCRModelConfig {
  architecture: 'CNN-RNN' | 'Transformer' | 'CRNN' | 'TrOCR';
  languageSupport: string[];
  maxImageSize: { width: number; height: number };
  vocabularySize: number;
  medicalTerminologySupport: boolean;
  handwritingSupport: boolean;
  multiLanguageSupport: boolean;
}

export interface FineTuningConfig {
  baseModel: string;
  layers: {
    freeze: string[];
    trainable: string[];
  };
  dataAugmentation: {
    rotation: boolean;
    noise: boolean;
    brightness: boolean;
    contrast: boolean;
    blur: boolean;
  };
  transferLearning: boolean;
  domainAdaptation: boolean;
}

export interface OCRModelMetrics extends PerformanceMetrics {
  characterAccuracy: number;
  wordAccuracy: number;
  editDistance: number;
  bleuScore: number;
  confidenceCalibration: number;
  languageSpecificAccuracy: Record<string, number>;
  documentTypeAccuracy: Record<string, number>;
}

export interface ValidationResult {
  overall: OCRModelMetrics;
  perLanguage: Record<string, OCRModelMetrics>;
  perDocumentType: Record<string, OCRModelMetrics>;
  confusionMatrix: ConfusionMatrix;
  errorAnalysis: ErrorAnalysis;
}

export interface ConfusionMatrix {
  matrix: number[][];
  labels: string[];
  accuracy: number;
  precision: number[];
  recall: number[];
  f1Score: number[];
}

export interface ErrorAnalysis {
  commonErrors: Array<{
    expected: string;
    predicted: string;
    frequency: number;
    context: string;
  }>;
  errorsByType: {
    substitution: number;
    insertion: number;
    deletion: number;
  };
  errorsByLanguage: Record<string, number>;
  errorsByQuality: Record<string, number>;
}

export class OCRModelTrainer extends EventEmitter implements AIComponent {
  private models: Map<string, AIModel> = new Map();
  private trainingQueue: TrainingRequest[] = [];
  private isTraining = false;
  private status: ComponentStatus;
  private config: OCRModelConfig;
  private vietnameseVocabulary: Set<string> = new Set();
  private medicalTerminology: Set<string> = new Set();

  constructor(config: OCRModelConfig) {
    super();
    this.config = config;
    this.status = {
      isReady: false,
      isProcessing: false,
      uptime: 0,
      totalProcessed: 0
    };
    this.initializeVocabularies();
  }

  async initialize(): Promise<void> {
    try {
      this.emit('initialization_started');
      
      // Load pre-trained models
      await this.loadPretrainedModels();
      
      // Initialize Vietnamese vocabulary
      await this.loadVietnameseVocabulary();
      
      // Initialize medical terminology
      await this.loadMedicalTerminology();
      
      // Setup training environment
      await this.setupTrainingEnvironment();
      
      this.status.isReady = true;
      this.emit('initialization_completed');
      
    } catch (error) {
      this.status.lastError = error.message;
      this.emit('initialization_failed', { error: error.message });
      throw error;
    }
  }

  private async initializeVocabularies(): Promise<void> {
    // Vietnamese characters and common words
    const vietnameseChars = 'aăâbcdđeêghiklmnoôơpqrstuưvxyàáạảãằắặẳẵầấậẩẫ��éẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ';
    vietnameseChars.split('').forEach(char => this.vietnameseVocabulary.add(char));
    
    // Common Vietnamese words in healthcare
    const commonWords = [
      'bệnh', 'viện', 'khám', 'thuốc', 'bác', 'sĩ', 'điều', 'trị',
      'xét', 'nghiệm', 'chẩn', 'đoán', 'hóa', 'đơn', 'toa', 'kê',
      'đơn', 'tái', 'khám', 'nhập', 'viện', 'xuất', 'viện', 'cấp',
      'cứu', 'phẫu', 'thuật', 'gây', 'mê', 'hồi', 'sức'
    ];
    commonWords.forEach(word => this.vietnameseVocabulary.add(word));
  }

  async process(input: any, options?: any): Promise<any> {
    if (input && typeof input === 'object' && 'modelType' in input && 'trainingData' in input) {
      return await this.trainModel(input as TrainingRequest);
    }
    throw new Error('Invalid input type for OCRModelTrainer');
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

  async trainModel(request: TrainingRequest): Promise<TrainingResult> {
    this.emit('training_started', { modelType: request.modelType });
    this.status.isProcessing = true;

    try {
      // Validate training data
      await this.validateTrainingData(request.trainingData as OCRTrainingData[]);
      
      // Prepare training environment
      const modelId = `ocr_${Date.now()}`;
      
      // Data preprocessing
      const preprocessedData = await this.preprocessTrainingData(
        request.trainingData as OCRTrainingData[]
      );
      
      // Data augmentation
      const augmentedData = await this.augmentTrainingData(preprocessedData);
      
      // Model architecture setup
      const model = await this.createModelArchitecture(request.options);
      
      // Training loop
      const trainingHistory = await this.executeTraining(
        model,
        augmentedData,
        request.validationData as OCRTrainingData[],
        request.options
      );
      
      // Model validation
      const validationResult = await this.validateModel(
        model,
        request.validationData as OCRTrainingData[]
      );
      
      // Save model
      const modelPath = await this.saveModel(model, modelId);
      
      // Update model registry
      const aiModel: AIModel = {
        id: modelId,
        name: `OCR Model ${modelId}`,
        version: '1.0.0',
        type: 'ocr',
        status: 'ready',
        accuracy: validationResult.overall.accuracy,
        lastTrained: new Date(),
        metadata: {
          trainingDataSize: request.trainingData.length,
          validationAccuracy: validationResult.overall.accuracy,
          testAccuracy: validationResult.overall.accuracy,
          modelSize: await this.getModelSize(modelPath),
          parameters: request.hyperparameters,
          performance: validationResult.overall
        }
      };
      
      this.models.set(modelId, aiModel);
      
      const result: TrainingResult = {
        modelId,
        success: true,
        finalAccuracy: validationResult.overall.accuracy,
        trainingHistory,
        modelPath,
        metadata: {
          trainingDuration: trainingHistory[trainingHistory.length - 1]?.timestamp.getTime() - trainingHistory[0]?.timestamp.getTime() || 0,
          datasetSize: request.trainingData.length,
          modelComplexity: Object.keys(request.hyperparameters).length,
          computeResources: {
            cpuHours: 2.5, // Mock data
            memoryPeakGB: 4.2,
            storageUsedGB: 1.8
          }
        }
      };

      this.status.totalProcessed++;
      this.emit('training_completed', { modelId, accuracy: validationResult.overall.accuracy });
      
      return result;

    } catch (error) {
      this.emit('training_failed', { error: error.message });
      throw error;
    } finally {
      this.status.isProcessing = false;
    }
  }

  async fineTuneModel(
    baseModelId: string,
    trainingData: OCRTrainingData[],
    config: FineTuningConfig
  ): Promise<TrainingResult> {
    this.emit('fine_tuning_started', { baseModelId });

    try {
      const baseModel = this.models.get(baseModelId);
      if (!baseModel) {
        throw new Error(`Base model ${baseModelId} not found`);
      }

      // Load base model
      const model = await this.loadModel(baseModel.metadata.parameters.modelPath);
      
      // Apply fine-tuning configuration
      await this.applyFineTuningConfig(model, config);
      
      // Fine-tuning specific preprocessing
      const preprocessedData = await this.preprocessForFineTuning(trainingData, config);
      
      // Execute fine-tuning
      const trainingHistory = await this.executeFineTuning(model, preprocessedData, config);
      
      // Validate fine-tuned model
      const validationData = trainingData.slice(-Math.floor(trainingData.length * 0.2));
      const validationResult = await this.validateModel(model, validationData);
      
      // Save fine-tuned model
      const fineTunedModelId = `${baseModelId}_ft_${Date.now()}`;
      const modelPath = await this.saveModel(model, fineTunedModelId);
      
      // Update model registry
      const fineTunedModel: AIModel = {
        ...baseModel,
        id: fineTunedModelId,
        name: `Fine-tuned ${baseModel.name}`,
        version: this.incrementVersion(baseModel.version),
        accuracy: validationResult.overall.accuracy,
        lastTrained: new Date(),
        metadata: {
          ...baseModel.metadata,
          validationAccuracy: validationResult.overall.accuracy,
          testAccuracy: validationResult.overall.accuracy,
          performance: validationResult.overall
        }
      };
      
      this.models.set(fineTunedModelId, fineTunedModel);
      
      const result: TrainingResult = {
        modelId: fineTunedModelId,
        success: true,
        finalAccuracy: validationResult.overall.accuracy,
        trainingHistory,
        modelPath,
        metadata: {
          trainingDuration: trainingHistory[trainingHistory.length - 1]?.timestamp.getTime() - trainingHistory[0]?.timestamp.getTime() || 0,
          datasetSize: trainingData.length,
          modelComplexity: Object.keys(config).length,
          computeResources: {
            cpuHours: 1.2,
            memoryPeakGB: 3.1,
            storageUsedGB: 0.8
          }
        }
      };

      this.emit('fine_tuning_completed', { modelId: fineTunedModelId, accuracy: validationResult.overall.accuracy });
      
      return result;

    } catch (error) {
      this.emit('fine_tuning_failed', { error: error.message });
      throw error;
    }
  }

  async evaluateModel(modelId: string, testData: OCRTrainingData[]): Promise<ValidationResult> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    this.emit('evaluation_started', { modelId });

    try {
      const loadedModel = await this.loadModel(model.metadata.parameters.modelPath);
      const validationResult = await this.validateModel(loadedModel, testData);
      
      this.emit('evaluation_completed', { modelId, result: validationResult });
      
      return validationResult;

    } catch (error) {
      this.emit('evaluation_failed', { error: error.message });
      throw error;
    }
  }

  async optimizeModel(modelId: string, optimizationConfig: any): Promise<string> {
    this.emit('optimization_started', { modelId });

    try {
      const model = this.models.get(modelId);
      if (!model) {
        throw new Error(`Model ${modelId} not found`);
      }

      const loadedModel = await this.loadModel(model.metadata.parameters.modelPath);
      
      // Apply optimization techniques
      const optimizedModel = await this.applyOptimizations(loadedModel, optimizationConfig);
      
      // Validate optimized model
      const optimizedModelId = `${modelId}_opt_${Date.now()}`;
      const modelPath = await this.saveModel(optimizedModel, optimizedModelId);
      
      // Update model registry
      const optimizedAIModel: AIModel = {
        ...model,
        id: optimizedModelId,
        name: `Optimized ${model.name}`,
        version: this.incrementVersion(model.version),
        lastTrained: new Date()
      };
      
      this.models.set(optimizedModelId, optimizedAIModel);
      
      this.emit('optimization_completed', { originalModelId: modelId, optimizedModelId });
      
      return optimizedModelId;

    } catch (error) {
      this.emit('optimization_failed', { error: error.message });
      throw error;
    }
  }

  private async validateTrainingData(data: OCRTrainingData[]): Promise<void> {
    if (data.length < 100) {
      throw new Error('Insufficient training data. Need at least 100 samples.');
    }

    // Check data quality
    const qualityIssues = [];
    for (const sample of data.slice(0, 10)) { // Sample check
      if (!sample.input || sample.input.length === 0) {
        qualityIssues.push('Empty image buffer');
      }
      if (!sample.expectedOutput.text || sample.expectedOutput.text.trim().length === 0) {
        qualityIssues.push('Empty expected text');
      }
    }

    if (qualityIssues.length > 0) {
      throw new Error(`Data quality issues: ${qualityIssues.join(', ')}`);
    }
  }

  private async preprocessTrainingData(data: OCRTrainingData[]): Promise<OCRTrainingData[]> {
    this.emit('preprocessing_started', { sampleCount: data.length });

    const preprocessed = await Promise.all(data.map(async (sample) => {
      // Image preprocessing
      const processedImage = await this.preprocessImage(sample.input);
      
      // Text normalization
      const normalizedText = this.normalizeVietnameseText(sample.expectedOutput.text);
      
      return {
        ...sample,
        input: processedImage,
        expectedOutput: {
          ...sample.expectedOutput,
          text: normalizedText
        }
      };
    }));

    this.emit('preprocessing_completed', { sampleCount: preprocessed.length });
    return preprocessed;
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    // Mock image preprocessing - in real implementation would use computer vision libraries
    // Resize, normalize, denoise, etc.
    return imageBuffer;
  }

  private normalizeVietnameseText(text: string): string {
    // Vietnamese text normalization
    let normalized = text.toLowerCase();
    
    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    // Normalize Vietnamese diacritics (basic normalization)
    const diacriticMap = new Map([
      ['à', 'a'], ['á', 'a'], ['ạ', 'a'], ['ả', 'a'], ['ã', 'a'],
      ['ằ', 'a'], ['ắ', 'a'], ['ặ', 'a'], ['ẳ', 'a'], ['ẵ', 'a'],
      ['ầ', 'a'], ['ấ', 'a'], ['ậ', 'a'], ['ẩ', 'a'], ['ẫ', 'a'],
      // Add more mappings as needed
    ]);
    
    // Keep diacritics for Vietnamese OCR training
    return normalized;
  }

  private async augmentTrainingData(data: OCRTrainingData[]): Promise<OCRTrainingData[]> {
    this.emit('augmentation_started', { originalSampleCount: data.length });

    const augmented = [...data];
    
    // Augmentation techniques for OCR training
    for (const sample of data) {
      // Rotation augmentation
      if (Math.random() > 0.7) {
        const rotatedSample = await this.rotateImageSample(sample, [-2, -1, 1, 2][Math.floor(Math.random() * 4)]);
        augmented.push(rotatedSample);
      }
      
      // Noise augmentation
      if (Math.random() > 0.8) {
        const noisySample = await this.addNoiseSample(sample);
        augmented.push(noisySample);
      }
      
      // Brightness/contrast augmentation
      if (Math.random() > 0.6) {
        const adjustedSample = await this.adjustBrightnessSample(sample);
        augmented.push(adjustedSample);
      }
    }

    this.emit('augmentation_completed', { 
      originalSampleCount: data.length, 
      augmentedSampleCount: augmented.length 
    });

    return augmented;
  }

  private async rotateImageSample(sample: OCRTrainingData, degrees: number): Promise<OCRTrainingData> {
    // Mock rotation - in real implementation would use image processing
    return {
      ...sample,
      metadata: {
        ...sample.metadata,
        augmentation: 'rotation',
        augmentationParams: { degrees }
      }
    };
  }

  private async addNoiseSample(sample: OCRTrainingData): Promise<OCRTrainingData> {
    // Mock noise addition
    return {
      ...sample,
      metadata: {
        ...sample.metadata,
        augmentation: 'noise',
        noiseLevel: sample.metadata.noiseLevel + 0.1
      }
    };
  }

  private async adjustBrightnessSample(sample: OCRTrainingData): Promise<OCRTrainingData> {
    // Mock brightness adjustment
    return {
      ...sample,
      metadata: {
        ...sample.metadata,
        augmentation: 'brightness'
      }
    };
  }

  private async createModelArchitecture(options: TrainingOptions): Promise<any> {
    // Mock model creation - in real implementation would use TensorFlow.js or ONNX
    this.emit('model_architecture_created', { architecture: this.config.architecture });
    return {
      id: `model_${Date.now()}`,
      architecture: this.config.architecture,
      parameters: options
    };
  }

  private async executeTraining(
    model: any,
    trainingData: OCRTrainingData[],
    validationData: OCRTrainingData[],
    options: TrainingOptions
  ): Promise<any[]> {
    const trainingHistory = [];
    
    for (let epoch = 1; epoch <= options.epochs; epoch++) {
      this.emit('epoch_started', { epoch, totalEpochs: options.epochs });
      
      // Mock training metrics
      const loss = Math.max(0.1, 2.0 - (epoch * 0.1) + (Math.random() - 0.5) * 0.2);
      const accuracy = Math.min(0.98, 0.5 + (epoch * 0.08) + (Math.random() - 0.5) * 0.05);
      const validationLoss = loss + 0.1;
      const validationAccuracy = accuracy - 0.05;
      
      const metrics = {
        epoch,
        loss,
        accuracy,
        validationLoss,
        validationAccuracy,
        timestamp: new Date()
      };
      
      trainingHistory.push(metrics);
      
      this.emit('epoch_completed', metrics);
      
      // Early stopping check
      if (options.earlyStopping && epoch > 5) {
        const recentAccuracies = trainingHistory.slice(-3).map(h => h.validationAccuracy);
        const isImproving = recentAccuracies[2] > recentAccuracies[0];
        if (!isImproving) {
          this.emit('early_stopping', { epoch });
          break;
        }
      }
    }
    
    return trainingHistory;
  }

  private async executeFineTuning(
    model: any,
    trainingData: OCRTrainingData[],
    config: FineTuningConfig
  ): Promise<any[]> {
    const trainingHistory = [];
    const epochs = 10; // Fine-tuning typically uses fewer epochs
    
    for (let epoch = 1; epoch <= epochs; epoch++) {
      this.emit('fine_tuning_epoch_started', { epoch, totalEpochs: epochs });
      
      // Mock fine-tuning metrics (typically better starting point)
      const loss = Math.max(0.05, 0.5 - (epoch * 0.03) + (Math.random() - 0.5) * 0.1);
      const accuracy = Math.min(0.995, 0.85 + (epoch * 0.02) + (Math.random() - 0.5) * 0.02);
      
      const metrics = {
        epoch,
        loss,
        accuracy,
        validationLoss: loss + 0.02,
        validationAccuracy: accuracy - 0.01,
        timestamp: new Date()
      };
      
      trainingHistory.push(metrics);
      this.emit('fine_tuning_epoch_completed', metrics);
    }
    
    return trainingHistory;
  }

  private async validateModel(model: any, testData: OCRTrainingData[]): Promise<ValidationResult> {
    this.emit('validation_started', { testSampleCount: testData.length });

    // Mock validation results - in real implementation would run inference
    const overall: OCRModelMetrics = {
      inferenceTime: 150,
      memoryUsage: 512,
      cpuUsage: 65,
      accuracy: 0.923,
      precision: 0.925,
      recall: 0.921,
      f1Score: 0.923,
      characterAccuracy: 0.945,
      wordAccuracy: 0.923,
      editDistance: 2.3,
      bleuScore: 0.887,
      confidenceCalibration: 0.892,
      languageSpecificAccuracy: {
        'vie': 0.923,
        'eng': 0.895
      },
      documentTypeAccuracy: {
        'medical_bill': 0.935,
        'prescription': 0.911,
        'lab_result': 0.928
      }
    };

    const perLanguage = {
      'vie': overall,
      'eng': { ...overall, accuracy: 0.895 }
    };

    const perDocumentType = {
      'medical_bill': { ...overall, accuracy: 0.935 },
      'prescription': { ...overall, accuracy: 0.911 },
      'lab_result': { ...overall, accuracy: 0.928 }
    };

    const confusionMatrix: ConfusionMatrix = {
      matrix: [[85, 3, 2], [4, 82, 4], [1, 5, 84]],
      labels: ['correct', 'substitution', 'deletion'],
      accuracy: 0.923,
      precision: [0.944, 0.911, 0.933],
      recall: [0.944, 0.911, 0.933],
      f1Score: [0.944, 0.911, 0.933]
    };

    const errorAnalysis: ErrorAnalysis = {
      commonErrors: [
        { expected: 'thuốc', predicted: 'thuóc', frequency: 15, context: 'prescription' },
        { expected: 'bệnh', predicted: 'benh', frequency: 12, context: 'medical_report' },
        { expected: 'viện', predicted: 'vien', frequency: 8, context: 'hospital_bill' }
      ],
      errorsByType: {
        substitution: 45,
        insertion: 23,
        deletion: 18
      },
      errorsByLanguage: {
        'vie': 67,
        'eng': 19
      },
      errorsByQuality: {
        'high': 12,
        'medium': 34,
        'low': 40
      }
    };

    const result: ValidationResult = {
      overall,
      perLanguage,
      perDocumentType,
      confusionMatrix,
      errorAnalysis
    };

    this.emit('validation_completed', { metrics: overall });
    return result;
  }

  private async loadPretrainedModels(): Promise<void> {
    // Mock loading pretrained models
    const pretrainedModels = [
      {
        id: 'vietnamese_base_ocr',
        name: 'Vietnamese Base OCR',
        version: '2.1.0',
        type: 'ocr' as const,
        status: 'ready' as const,
        accuracy: 0.89,
        lastTrained: new Date('2024-01-01'),
        metadata: {
          trainingDataSize: 50000,
          validationAccuracy: 0.89,
          testAccuracy: 0.87,
          modelSize: 125,
          parameters: {},
          performance: {
            inferenceTime: 120,
            memoryUsage: 256,
            cpuUsage: 45,
            accuracy: 0.89,
            precision: 0.88,
            recall: 0.90,
            f1Score: 0.89
          }
        }
      }
    ];

    pretrainedModels.forEach(model => this.models.set(model.id, model));
    this.emit('pretrained_models_loaded', { count: pretrainedModels.length });
  }

  private async loadVietnameseVocabulary(): Promise<void> {
    // Load comprehensive Vietnamese vocabulary for healthcare
    const medicalTerms = [
      'bệnh viện', 'phòng khám', 'hóa đơn', 'viện phí', 'đơn thuốc',
      'xét nghiệm', 'chẩn đoán', 'bác sĩ', 'y tá', 'điều trị',
      'nhập viện', 'xuất viện', 'cấp cứu', 'phẫu thuật', 'gây mê'
    ];
    
    medicalTerms.forEach(term => this.vietnameseVocabulary.add(term));
    this.emit('vocabulary_loaded', { size: this.vietnameseVocabulary.size });
  }

  private async loadMedicalTerminology(): Promise<void> {
    // Load medical terminology specific to Vietnamese healthcare
    const terminology = [
      'hemoglobin', 'hematocrit', 'leucocyte', 'erythrocyte', 'platelet',
      'glucose', 'cholesterol', 'triglyceride', 'creatinine', 'urea',
      'AST', 'ALT', 'GGT', 'bilirubin', 'albumin'
    ];
    
    terminology.forEach(term => this.medicalTerminology.add(term));
    this.emit('medical_terminology_loaded', { size: this.medicalTerminology.size });
  }

  private async setupTrainingEnvironment(): Promise<void> {
    // Setup training environment, directories, etc.
    this.emit('training_environment_setup');
  }

  private async applyFineTuningConfig(model: any, config: FineTuningConfig): Promise<void> {
    // Apply fine-tuning configuration
    this.emit('fine_tuning_config_applied', { config });
  }

  private async preprocessForFineTuning(
    data: OCRTrainingData[],
    config: FineTuningConfig
  ): Promise<OCRTrainingData[]> {
    // Specialized preprocessing for fine-tuning
    return data;
  }

  private async applyOptimizations(model: any, config: any): Promise<any> {
    // Apply model optimization techniques
    this.emit('optimizations_applied', { techniques: Object.keys(config) });
    return model;
  }

  private async saveModel(model: any, modelId: string): Promise<string> {
    const modelPath = `/models/ocr/${modelId}`;
    this.emit('model_saved', { modelId, path: modelPath });
    return modelPath;
  }

  private async loadModel(modelPath: string): Promise<any> {
    this.emit('model_loaded', { path: modelPath });
    return { id: 'loaded_model', path: modelPath };
  }

  private async getModelSize(modelPath: string): Promise<number> {
    // Return model size in MB
    return 128;
  }

  private calculateAverageAccuracy(): number {
    const models = Array.from(this.models.values());
    if (models.length === 0) return 0;
    return models.reduce((sum, model) => sum + model.accuracy, 0) / models.length;
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  // Public API methods
  getModels(): AIModel[] {
    return Array.from(this.models.values());
  }

  getModel(modelId: string): AIModel | undefined {
    return this.models.get(modelId);
  }

  async deleteModel(modelId: string): Promise<void> {
    if (this.models.has(modelId)) {
      this.models.delete(modelId);
      this.emit('model_deleted', { modelId });
    }
  }

  getTrainingQueue(): TrainingRequest[] {
    return [...this.trainingQueue];
  }

  async addToTrainingQueue(request: TrainingRequest): Promise<void> {
    this.trainingQueue.push(request);
    this.emit('training_queued', { position: this.trainingQueue.length });
  }

  getVocabularySize(): number {
    return this.vietnameseVocabulary.size;
  }

  getMedicalTerminologySize(): number {
    return this.medicalTerminology.size;
  }
}
