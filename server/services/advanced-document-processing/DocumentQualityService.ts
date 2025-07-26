import { EventEmitter } from 'events';
import sharp from 'sharp';

export interface QualityAssessmentResult {
  overallQuality: QualityScore;
  qualityMetrics: QualityMetrics;
  issues: QualityIssue[];
  improvements: QualityImprovement[];
  recommendations: QualityRecommendation[];
  processingMetadata: {
    processingTime: number;
    assessorVersion: string;
    metricsCalculated: number;
  };
}

export interface QualityScore {
  score: number; // 0-100
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'unusable';
  confidence: number;
}

export interface QualityMetrics {
  imageQuality: ImageQualityMetrics;
  textQuality: TextQualityMetrics;
  structuralQuality: StructuralQualityMetrics;
  completeness: CompletenessMetrics;
}

export interface ImageQualityMetrics {
  resolution: { width: number; height: number; dpi: number };
  sharpness: number; // 0-1
  contrast: number; // 0-1
  brightness: number; // 0-1
  noise: number; // 0-1
  blur: number; // 0-1
  skew: number; // degrees
  colorSpace: string;
  fileSize: number;
  compression: number; // 0-1
}

export interface TextQualityMetrics {
  readability: number; // 0-1
  ocrAccuracy: number; // 0-1
  characterConfidence: number; // 0-1
  wordConfidence: number; // 0-1
  lineConfidence: number; // 0-1
  fontQuality: number; // 0-1
  textDensity: number; // 0-1
  languageDetectionConfidence: number; // 0-1
}

export interface StructuralQualityMetrics {
  layoutDetection: number; // 0-1
  marginQuality: number; // 0-1
  alignment: number; // 0-1
  tableDetection: number; // 0-1
  formFieldDetection: number; // 0-1
  logoDetection: number; // 0-1
  signatureDetection: number; // 0-1
  sectionOrganization: number; // 0-1
}

export interface CompletenessMetrics {
  fieldCompleteness: number; // 0-1
  requiredElementsPresent: number; // 0-1
  dataIntegrity: number; // 0-1
  missingInformation: string[];
  corruptedAreas: string[];
}

export interface QualityIssue {
  type: QualityIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: { x: number; y: number; width: number; height: number };
  affectedMetric: string;
  impact: number; // 0-1
  autoFixable: boolean;
}

export interface QualityImprovement {
  type: ImprovementType;
  description: string;
  expectedImprovement: number; // 0-1
  difficulty: 'easy' | 'medium' | 'hard';
  automated: boolean;
  steps: string[];
}

export interface QualityRecommendation {
  category: RecommendationCategory;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  actionItems: string[];
  estimatedImpact: number; // 0-1
}

export type QualityIssueType =
  | 'low_resolution'
  | 'poor_contrast'
  | 'blur'
  | 'noise'
  | 'skew'
  | 'poor_lighting'
  | 'compression_artifacts'
  | 'incomplete_scan'
  | 'missing_text'
  | 'corrupted_data'
  | 'poor_alignment'
  | 'invalid_format'
  | 'damaged_document';

export type ImprovementType =
  | 'enhance_resolution'
  | 'adjust_contrast'
  | 'reduce_noise'
  | 'correct_skew'
  | 'improve_lighting'
  | 'reduce_compression'
  | 'complete_scan'
  | 'restore_text'
  | 'fix_alignment'
  | 'format_correction';

export type RecommendationCategory =
  | 'scanning_technique'
  | 'image_processing'
  | 'document_handling'
  | 'equipment_upgrade'
  | 'process_improvement';

export class DocumentQualityService extends EventEmitter {
  private qualityThresholds = {
    excellent: 90,
    good: 75,
    fair: 60,
    poor: 40,
    unusable: 0
  };

  private weights = {
    imageQuality: 0.3,
    textQuality: 0.4,
    structuralQuality: 0.2,
    completeness: 0.1
  };

  constructor() {
    super();
  }

  async assessQuality(
    documentBuffer: Buffer,
    ocrResult?: any,
    extractedData?: any,
    documentType?: string
  ): Promise<QualityAssessmentResult> {
    const startTime = Date.now();

    try {
      // Analyze image quality
      const imageQuality = await this.analyzeImageQuality(documentBuffer);
      
      // Analyze text quality
      const textQuality = await this.analyzeTextQuality(ocrResult, extractedData);
      
      // Analyze structural quality
      const structuralQuality = await this.analyzeStructuralQuality(documentBuffer, extractedData);
      
      // Analyze completeness
      const completeness = await this.analyzeCompleteness(extractedData, documentType);

      const qualityMetrics: QualityMetrics = {
        imageQuality,
        textQuality,
        structuralQuality,
        completeness
      };

      // Calculate overall quality score
      const overallQuality = this.calculateOverallQuality(qualityMetrics);
      
      // Identify issues
      const issues = await this.identifyIssues(qualityMetrics, documentBuffer);
      
      // Generate improvements
      const improvements = await this.generateImprovements(issues, qualityMetrics);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(overallQuality, issues, improvements);

      const result: QualityAssessmentResult = {
        overallQuality,
        qualityMetrics,
        issues,
        improvements,
        recommendations,
        processingMetadata: {
          processingTime: Date.now() - startTime,
          assessorVersion: '2.0.0',
          metricsCalculated: 4
        }
      };

      this.emit('qualityAssessed', {
        overallScore: overallQuality.score,
        grade: overallQuality.grade,
        issuesCount: issues.length,
        processingTime: result.processingMetadata.processingTime
      });

      return result;

    } catch (error) {
      this.emit('qualityAssessmentError', { error: error.message });
      throw new Error(`Quality assessment failed: ${error.message}`);
    }
  }

  private async analyzeImageQuality(documentBuffer: Buffer): Promise<ImageQualityMetrics> {
    const imageInfo = await sharp(documentBuffer).metadata();
    
    // Calculate basic image metrics
    const width = imageInfo.width || 0;
    const height = imageInfo.height || 0;
    const dpi = imageInfo.density || 72;
    const fileSize = documentBuffer.length;

    // Analyze image data
    const { data, info } = await sharp(documentBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate sharpness (using Laplacian variance)
    const sharpness = this.calculateSharpness(data, info.width, info.height, info.channels);
    
    // Calculate contrast
    const contrast = this.calculateContrast(data, info.width, info.height, info.channels);
    
    // Calculate brightness
    const brightness = this.calculateBrightness(data, info.width, info.height, info.channels);
    
    // Calculate noise level
    const noise = this.calculateNoise(data, info.width, info.height, info.channels);
    
    // Calculate blur metric
    const blur = 1 - sharpness; // Inverse of sharpness
    
    // Detect skew
    const skew = await this.detectSkew(documentBuffer);
    
    // Calculate compression ratio
    const uncompressedSize = width * height * (info.channels || 3);
    const compression = Math.min(1, fileSize / uncompressedSize);

    return {
      resolution: { width, height, dpi },
      sharpness,
      contrast,
      brightness,
      noise,
      blur,
      skew,
      colorSpace: imageInfo.space || 'unknown',
      fileSize,
      compression
    };
  }

  private calculateSharpness(data: Buffer, width: number, height: number, channels: number): number {
    // Simple Laplacian filter for edge detection
    if (channels < 1 || width < 3 || height < 3) return 0;

    let sum = 0;
    let count = 0;

    // Convert to grayscale if needed and apply Laplacian
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = y * width + x;
        const centerIdx = center * channels;
        
        // Get pixel value (convert to grayscale if color)
        const centerVal = channels > 1 
          ? (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3
          : data[centerIdx];

        // Apply Laplacian kernel
        const neighbors = [
          data[((y-1) * width + x) * channels],
          data[(y * width + (x-1)) * channels],
          data[(y * width + (x+1)) * channels],
          data[((y+1) * width + x) * channels]
        ];

        const laplacian = Math.abs(4 * centerVal - neighbors.reduce((sum, val) => sum + val, 0));
        sum += laplacian;
        count++;
      }
    }

    return Math.min(1, (sum / count) / 255);
  }

  private calculateContrast(data: Buffer, width: number, height: number, channels: number): number {
    if (channels < 1 || width < 1 || height < 1) return 0;

    let min = 255;
    let max = 0;
    
    for (let i = 0; i < data.length; i += channels) {
      // Convert to grayscale if needed
      const value = channels > 1 
        ? (data[i] + data[i + 1] + data[i + 2]) / 3
        : data[i];
      
      min = Math.min(min, value);
      max = Math.max(max, value);
    }

    return (max - min) / 255;
  }

  private calculateBrightness(data: Buffer, width: number, height: number, channels: number): number {
    if (channels < 1 || width < 1 || height < 1) return 0;

    let sum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += channels) {
      // Convert to grayscale if needed
      const value = channels > 1 
        ? (data[i] + data[i + 1] + data[i + 2]) / 3
        : data[i];
      
      sum += value;
      count++;
    }

    return (sum / count) / 255;
  }

  private calculateNoise(data: Buffer, width: number, height: number, channels: number): number {
    if (channels < 1 || width < 3 || height < 3) return 0;

    let variance = 0;
    let count = 0;

    // Calculate local variance as noise measure
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const center = y * width + x;
        const centerIdx = center * channels;
        
        const centerVal = channels > 1 
          ? (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3
          : data[centerIdx];

        // Calculate local variance in 3x3 window
        let localSum = 0;
        let localCount = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * channels;
            const val = channels > 1 
              ? (data[idx] + data[idx + 1] + data[idx + 2]) / 3
              : data[idx];
            localSum += (val - centerVal) ** 2;
            localCount++;
          }
        }

        variance += localSum / localCount;
        count++;
      }
    }

    return Math.min(1, Math.sqrt(variance / count) / 255);
  }

  private async detectSkew(documentBuffer: Buffer): Promise<number> {
    // Mock skew detection - in real implementation would use Hough transform
    // to detect document edges and calculate rotation angle
    const mockSkewAngles = [-2.5, -1.2, -0.8, 0, 0.5, 1.1, 2.3];
    return mockSkewAngles[Math.floor(Math.random() * mockSkewAngles.length)];
  }

  private async analyzeTextQuality(ocrResult?: any, extractedData?: any): Promise<TextQualityMetrics> {
    if (!ocrResult) {
      return {
        readability: 0,
        ocrAccuracy: 0,
        characterConfidence: 0,
        wordConfidence: 0,
        lineConfidence: 0,
        fontQuality: 0,
        textDensity: 0,
        languageDetectionConfidence: 0
      };
    }

    // Calculate OCR accuracy based on confidence scores
    const characterConfidence = ocrResult.words 
      ? ocrResult.words.reduce((sum: number, word: any) => sum + (word.confidence || 0), 0) / ocrResult.words.length
      : 0;

    const wordConfidence = ocrResult.words 
      ? ocrResult.words.filter((word: any) => (word.confidence || 0) > 0.8).length / ocrResult.words.length
      : 0;

    const lineConfidence = ocrResult.lines 
      ? ocrResult.lines.reduce((sum: number, line: any) => sum + (line.confidence || 0), 0) / ocrResult.lines.length
      : 0;

    // Calculate readability based on text structure
    const text = ocrResult.text || '';
    const readability = this.calculateReadability(text);

    // Calculate font quality based on OCR confidence and text characteristics
    const fontQuality = this.calculateFontQuality(ocrResult);

    // Calculate text density
    const textDensity = this.calculateTextDensity(text, ocrResult.metadata?.imageResolution);

    // Language detection confidence
    const languageDetectionConfidence = ocrResult.detectedLanguage === 'vie' ? 0.9 : 0.7;

    // Overall OCR accuracy estimate
    const ocrAccuracy = (characterConfidence + wordConfidence + lineConfidence) / 3;

    return {
      readability,
      ocrAccuracy,
      characterConfidence,
      wordConfidence,
      lineConfidence,
      fontQuality,
      textDensity,
      languageDetectionConfidence
    };
  }

  private calculateReadability(text: string): number {
    if (!text || text.length === 0) return 0;

    // Simple readability metrics for Vietnamese text
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const characters = text.replace(/\s/g, '').length;

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgCharsPerWord = characters / words.length;

    // Vietnamese readability heuristics
    const idealWordsPerSentence = 15;
    const idealCharsPerWord = 5;

    const sentenceScore = 1 - Math.abs(avgWordsPerSentence - idealWordsPerSentence) / idealWordsPerSentence;
    const wordScore = 1 - Math.abs(avgCharsPerWord - idealCharsPerWord) / idealCharsPerWord;

    return Math.max(0, Math.min(1, (sentenceScore + wordScore) / 2));
  }

  private calculateFontQuality(ocrResult: any): number {
    if (!ocrResult.words) return 0;

    // Analyze font consistency and quality
    const fontSizes = ocrResult.words.map((word: any) => word.fontSize || 12);
    const fontStyles = ocrResult.words.map((word: any) => word.fontStyle || 'normal');

    // Calculate font size consistency
    const avgFontSize = fontSizes.reduce((sum: number, size: number) => sum + size, 0) / fontSizes.length;
    const fontSizeVariance = fontSizes.reduce((sum: number, size: number) => sum + Math.pow(size - avgFontSize, 2), 0) / fontSizes.length;
    const fontSizeConsistency = 1 - Math.min(1, fontSizeVariance / (avgFontSize * avgFontSize));

    // Calculate style consistency
    const styleMap = fontStyles.reduce((map: any, style: string) => {
      map[style] = (map[style] || 0) + 1;
      return map;
    }, {});
    const dominantStyleRatio = Math.max(...Object.values(styleMap)) / fontStyles.length;

    return (fontSizeConsistency + dominantStyleRatio) / 2;
  }

  private calculateTextDensity(text: string, imageResolution?: { width: number; height: number }): number {
    if (!text || !imageResolution) return 0;

    const textLength = text.replace(/\s/g, '').length;
    const imageArea = imageResolution.width * imageResolution.height;
    
    // Estimate text density (characters per pixel area)
    const density = textLength / imageArea;
    
    // Normalize to 0-1 range (typical document has ~0.001-0.01 chars per pixel)
    return Math.min(1, density * 1000);
  }

  private async analyzeStructuralQuality(documentBuffer: Buffer, extractedData?: any): Promise<StructuralQualityMetrics> {
    // Mock structural analysis - in real implementation would use computer vision
    // to detect layout elements, tables, forms, etc.

    const layoutDetection = Math.random() * 0.3 + 0.7; // 0.7-1.0
    const marginQuality = Math.random() * 0.4 + 0.6; // 0.6-1.0
    const alignment = Math.random() * 0.3 + 0.7; // 0.7-1.0
    
    // Base detection on extracted data
    const tableDetection = extractedData?.services || extractedData?.results ? 0.9 : 0.1;
    const formFieldDetection = extractedData ? 0.8 : 0.2;
    const logoDetection = Math.random() * 0.5 + 0.3; // 0.3-0.8
    const signatureDetection = extractedData?.signature ? 0.9 : Math.random() * 0.3;
    
    // Calculate section organization based on data structure
    const sectionOrganization = extractedData ? 
      Math.min(1, Object.keys(extractedData).length / 10) : 0.5;

    return {
      layoutDetection,
      marginQuality,
      alignment,
      tableDetection,
      formFieldDetection,
      logoDetection,
      signatureDetection,
      sectionOrganization
    };
  }

  private async analyzeCompleteness(extractedData?: any, documentType?: string): Promise<CompletenessMetrics> {
    if (!extractedData || !documentType) {
      return {
        fieldCompleteness: 0,
        requiredElementsPresent: 0,
        dataIntegrity: 0,
        missingInformation: ['No extracted data available'],
        corruptedAreas: []
      };
    }

    // Define required fields by document type
    const requiredFields = this.getRequiredFields(documentType);
    const presentFields = Object.keys(extractedData).filter(key => 
      extractedData[key] !== null && extractedData[key] !== undefined && extractedData[key] !== ''
    );

    const fieldCompleteness = presentFields.length / Math.max(requiredFields.length, 1);
    
    const requiredPresent = requiredFields.filter(field => presentFields.includes(field));
    const requiredElementsPresent = requiredPresent.length / requiredFields.length;

    // Analyze data integrity
    const dataIntegrity = this.calculateDataIntegrity(extractedData);

    // Identify missing information
    const missingInformation = requiredFields.filter(field => !presentFields.includes(field));

    // Mock corrupted areas detection
    const corruptedAreas: string[] = [];
    if (dataIntegrity < 0.8) {
      corruptedAreas.push('Text quality issues detected');
    }
    if (fieldCompleteness < 0.7) {
      corruptedAreas.push('Missing field data');
    }

    return {
      fieldCompleteness: Math.min(1, fieldCompleteness),
      requiredElementsPresent,
      dataIntegrity,
      missingInformation,
      corruptedAreas
    };
  }

  private getRequiredFields(documentType: string): string[] {
    switch (documentType) {
      case 'medical_bill':
        return ['hospitalName', 'billNumber', 'billDate', 'patientName', 'totalAmount'];
      case 'prescription':
        return ['doctorName', 'patientName', 'prescriptionDate', 'medications'];
      case 'lab_result':
        return ['labName', 'patientName', 'testDate', 'results'];
      default:
        return ['patientName', 'date'];
    }
  }

  private calculateDataIntegrity(extractedData: any): number {
    let integrityScore = 1.0;
    let checks = 0;

    // Check date validity
    if (extractedData.billDate || extractedData.prescriptionDate || extractedData.testDate) {
      const dateStr = extractedData.billDate || extractedData.prescriptionDate || extractedData.testDate;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        integrityScore -= 0.2;
      }
      checks++;
    }

    // Check amount validity
    if (extractedData.totalAmount) {
      const amount = parseFloat(extractedData.totalAmount.toString().replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        integrityScore -= 0.2;
      }
      checks++;
    }

    // Check name format
    if (extractedData.patientName) {
      const namePattern = /^[A-ZÀ-Ỹ][a-zà-ỹ]+(\s[A-ZÀ-Ỹ][a-zà-ỹ]+)*$/;
      if (!namePattern.test(extractedData.patientName)) {
        integrityScore -= 0.15;
      }
      checks++;
    }

    // Check for consistency between related fields
    if (extractedData.services && extractedData.totalAmount) {
      // Mock consistency check
      integrityScore -= 0.1; // Small penalty for complexity
      checks++;
    }

    return Math.max(0, checks > 0 ? integrityScore : 0.5);
  }

  private calculateOverallQuality(metrics: QualityMetrics): QualityScore {
    // Calculate weighted average
    const imageScore = this.calculateImageScore(metrics.imageQuality);
    const textScore = this.calculateTextScore(metrics.textQuality);
    const structuralScore = this.calculateStructuralScore(metrics.structuralQuality);
    const completenessScore = this.calculateCompletenessScore(metrics.completeness);

    const weightedScore = 
      imageScore * this.weights.imageQuality +
      textScore * this.weights.textQuality +
      structuralScore * this.weights.structuralQuality +
      completenessScore * this.weights.completeness;

    const score = Math.round(weightedScore * 100);
    const grade = this.getQualityGrade(score);
    
    // Calculate confidence based on individual metric confidences
    const confidence = Math.min(1, 
      (metrics.textQuality.ocrAccuracy + 
       metrics.completeness.dataIntegrity + 
       metrics.imageQuality.sharpness + 
       metrics.structuralQuality.layoutDetection) / 4
    );

    return { score, grade, confidence };
  }

  private calculateImageScore(imageQuality: ImageQualityMetrics): number {
    const resolutionScore = Math.min(1, imageQuality.resolution.dpi / 300); // 300 DPI ideal
    const clarityScore = (imageQuality.sharpness + (1 - imageQuality.blur) + (1 - imageQuality.noise)) / 3;
    const visualScore = (imageQuality.contrast + imageQuality.brightness) / 2;
    const skewPenalty = Math.max(0, 1 - Math.abs(imageQuality.skew) / 10); // 10 degrees max penalty

    return (resolutionScore + clarityScore + visualScore + skewPenalty) / 4;
  }

  private calculateTextScore(textQuality: TextQualityMetrics): number {
    return (
      textQuality.ocrAccuracy * 0.3 +
      textQuality.readability * 0.2 +
      textQuality.characterConfidence * 0.2 +
      textQuality.fontQuality * 0.15 +
      textQuality.languageDetectionConfidence * 0.15
    );
  }

  private calculateStructuralScore(structuralQuality: StructuralQualityMetrics): number {
    return (
      structuralQuality.layoutDetection * 0.25 +
      structuralQuality.alignment * 0.2 +
      structuralQuality.marginQuality * 0.15 +
      structuralQuality.sectionOrganization * 0.15 +
      structuralQuality.tableDetection * 0.1 +
      structuralQuality.formFieldDetection * 0.1 +
      structuralQuality.logoDetection * 0.05
    );
  }

  private calculateCompletenessScore(completeness: CompletenessMetrics): number {
    return (
      completeness.fieldCompleteness * 0.4 +
      completeness.requiredElementsPresent * 0.35 +
      completeness.dataIntegrity * 0.25
    );
  }

  private getQualityGrade(score: number): QualityScore['grade'] {
    if (score >= this.qualityThresholds.excellent) return 'excellent';
    if (score >= this.qualityThresholds.good) return 'good';
    if (score >= this.qualityThresholds.fair) return 'fair';
    if (score >= this.qualityThresholds.poor) return 'poor';
    return 'unusable';
  }

  private async identifyIssues(
    metrics: QualityMetrics,
    documentBuffer: Buffer
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Image quality issues
    if (metrics.imageQuality.resolution.dpi < 150) {
      issues.push({
        type: 'low_resolution',
        severity: 'high',
        description: `Low resolution detected: ${metrics.imageQuality.resolution.dpi} DPI (minimum 150 DPI recommended)`,
        affectedMetric: 'imageQuality.resolution',
        impact: 0.3,
        autoFixable: false
      });
    }

    if (metrics.imageQuality.contrast < 0.3) {
      issues.push({
        type: 'poor_contrast',
        severity: 'medium',
        description: `Poor contrast detected: ${(metrics.imageQuality.contrast * 100).toFixed(1)}%`,
        affectedMetric: 'imageQuality.contrast',
        impact: 0.2,
        autoFixable: true
      });
    }

    if (metrics.imageQuality.blur > 0.7) {
      issues.push({
        type: 'blur',
        severity: 'high',
        description: `High blur level detected: ${(metrics.imageQuality.blur * 100).toFixed(1)}%`,
        affectedMetric: 'imageQuality.blur',
        impact: 0.4,
        autoFixable: true
      });
    }

    if (metrics.imageQuality.noise > 0.5) {
      issues.push({
        type: 'noise',
        severity: 'medium',
        description: `High noise level detected: ${(metrics.imageQuality.noise * 100).toFixed(1)}%`,
        affectedMetric: 'imageQuality.noise',
        impact: 0.2,
        autoFixable: true
      });
    }

    if (Math.abs(metrics.imageQuality.skew) > 2) {
      issues.push({
        type: 'skew',
        severity: 'medium',
        description: `Document skew detected: ${metrics.imageQuality.skew.toFixed(1)} degrees`,
        affectedMetric: 'imageQuality.skew',
        impact: 0.15,
        autoFixable: true
      });
    }

    // Text quality issues
    if (metrics.textQuality.ocrAccuracy < 0.8) {
      issues.push({
        type: 'missing_text',
        severity: 'high',
        description: `Low OCR accuracy: ${(metrics.textQuality.ocrAccuracy * 100).toFixed(1)}%`,
        affectedMetric: 'textQuality.ocrAccuracy',
        impact: 0.4,
        autoFixable: false
      });
    }

    // Completeness issues
    if (metrics.completeness.fieldCompleteness < 0.7) {
      issues.push({
        type: 'incomplete_scan',
        severity: 'high',
        description: `Incomplete data extraction: ${(metrics.completeness.fieldCompleteness * 100).toFixed(1)}% fields extracted`,
        affectedMetric: 'completeness.fieldCompleteness',
        impact: 0.3,
        autoFixable: false
      });
    }

    if (metrics.completeness.corruptedAreas.length > 0) {
      issues.push({
        type: 'corrupted_data',
        severity: 'critical',
        description: `Corrupted areas detected: ${metrics.completeness.corruptedAreas.join(', ')}`,
        affectedMetric: 'completeness.dataIntegrity',
        impact: 0.5,
        autoFixable: false
      });
    }

    return issues;
  }

  private async generateImprovements(
    issues: QualityIssue[],
    metrics: QualityMetrics
  ): Promise<QualityImprovement[]> {
    const improvements: QualityImprovement[] = [];

    // Group issues by type and generate improvements
    const issueTypes = new Set(issues.map(issue => issue.type));

    issueTypes.forEach(type => {
      switch (type) {
        case 'low_resolution':
          improvements.push({
            type: 'enhance_resolution',
            description: 'Rescan document at higher resolution (300+ DPI)',
            expectedImprovement: 0.3,
            difficulty: 'easy',
            automated: false,
            steps: [
              'Use scanner settings of 300 DPI or higher',
              'Ensure document is flat against scanner glass',
              'Use photo mode instead of text mode for better quality'
            ]
          });
          break;

        case 'poor_contrast':
          improvements.push({
            type: 'adjust_contrast',
            description: 'Enhance image contrast automatically',
            expectedImprovement: 0.2,
            difficulty: 'easy',
            automated: true,
            steps: [
              'Apply histogram equalization',
              'Adjust gamma correction',
              'Enhance dynamic range'
            ]
          });
          break;

        case 'blur':
          improvements.push({
            type: 'reduce_noise',
            description: 'Apply sharpening filters to reduce blur',
            expectedImprovement: 0.3,
            difficulty: 'medium',
            automated: true,
            steps: [
              'Apply unsharp mask filter',
              'Use deconvolution algorithms',
              'Enhance edge detection'
            ]
          });
          break;

        case 'skew':
          improvements.push({
            type: 'correct_skew',
            description: 'Automatically correct document skew',
            expectedImprovement: 0.15,
            difficulty: 'easy',
            automated: true,
            steps: [
              'Detect document edges',
              'Calculate rotation angle',
              'Apply rotation transformation'
            ]
          });
          break;

        case 'noise':
          improvements.push({
            type: 'reduce_noise',
            description: 'Apply noise reduction filters',
            expectedImprovement: 0.2,
            difficulty: 'easy',
            automated: true,
            steps: [
              'Apply median filter',
              'Use bilateral filtering',
              'Apply morphological operations'
            ]
          });
          break;
      }
    });

    return improvements;
  }

  private async generateRecommendations(
    overallQuality: QualityScore,
    issues: QualityIssue[],
    improvements: QualityImprovement[]
  ): Promise<QualityRecommendation[]> {
    const recommendations: QualityRecommendation[] = [];

    // General recommendations based on quality grade
    switch (overallQuality.grade) {
      case 'unusable':
        recommendations.push({
          category: 'document_handling',
          priority: 'urgent',
          title: 'Document requires re-scanning',
          description: 'Document quality is too poor for reliable processing',
          actionItems: [
            'Rescan document with better equipment',
            'Ensure proper lighting and document positioning',
            'Consider manual data entry as fallback'
          ],
          estimatedImpact: 0.8
        });
        break;

      case 'poor':
        recommendations.push({
          category: 'scanning_technique',
          priority: 'high',
          title: 'Improve scanning technique',
          description: 'Current scanning quality significantly impacts data extraction',
          actionItems: [
            'Use higher resolution settings (300+ DPI)',
            'Improve lighting conditions',
            'Ensure document is flat and properly aligned'
          ],
          estimatedImpact: 0.6
        });
        break;

      case 'fair':
        recommendations.push({
          category: 'image_processing',
          priority: 'medium',
          title: 'Apply image enhancement',
          description: 'Quality can be improved with post-processing',
          actionItems: [
            'Apply automatic contrast enhancement',
            'Use noise reduction filters',
            'Correct any skew or rotation'
          ],
          estimatedImpact: 0.4
        });
        break;
    }

    // Specific recommendations based on critical issues
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        category: 'document_handling',
        priority: 'urgent',
        title: 'Address critical quality issues',
        description: 'Critical issues detected that prevent reliable processing',
        actionItems: criticalIssues.map(issue => `Fix: ${issue.description}`),
        estimatedImpact: 0.7
      });
    }

    // Equipment upgrade recommendations
    const imageIssues = issues.filter(issue => 
      ['low_resolution', 'poor_contrast', 'blur'].includes(issue.type)
    );
    if (imageIssues.length >= 2) {
      recommendations.push({
        category: 'equipment_upgrade',
        priority: 'medium',
        title: 'Consider equipment upgrade',
        description: 'Multiple image quality issues suggest equipment limitations',
        actionItems: [
          'Evaluate current scanner specifications',
          'Consider upgrading to higher-quality scanner',
          'Ensure proper maintenance of scanning equipment'
        ],
        estimatedImpact: 0.5
      });
    }

    // Process improvement recommendations
    if (improvements.filter(imp => !imp.automated).length > 2) {
      recommendations.push({
        category: 'process_improvement',
        priority: 'medium',
        title: 'Implement quality control process',
        description: 'Multiple manual improvements needed suggest process gaps',
        actionItems: [
          'Implement pre-scan quality checklist',
          'Train staff on optimal scanning techniques',
          'Set up quality validation before submission'
        ],
        estimatedImpact: 0.4
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Batch quality assessment
  async assessBatchQuality(
    documents: Array<{
      documentBuffer: Buffer;
      ocrResult?: any;
      extractedData?: any;
      documentType?: string;
    }>
  ): Promise<QualityAssessmentResult[]> {
    const results = await Promise.all(
      documents.map(doc => 
        this.assessQuality(
          doc.documentBuffer,
          doc.ocrResult,
          doc.extractedData,
          doc.documentType
        )
      )
    );

    this.emit('batchQualityAssessmentCompleted', {
      totalDocuments: documents.length,
      averageScore: results.reduce((sum, r) => sum + r.overallQuality.score, 0) / results.length,
      excellentCount: results.filter(r => r.overallQuality.grade === 'excellent').length,
      poorCount: results.filter(r => r.overallQuality.grade === 'poor' || r.overallQuality.grade === 'unusable').length
    });

    return results;
  }

  // Auto-improvement application
  async applyAutoImprovements(
    documentBuffer: Buffer,
    improvements: QualityImprovement[]
  ): Promise<Buffer> {
    let processedBuffer = documentBuffer;

    const autoImprovements = improvements.filter(imp => imp.automated);

    for (const improvement of autoImprovements) {
      try {
        switch (improvement.type) {
          case 'adjust_contrast':
            processedBuffer = await this.enhanceContrast(processedBuffer);
            break;
          case 'reduce_noise':
            processedBuffer = await this.reduceNoise(processedBuffer);
            break;
          case 'correct_skew':
            processedBuffer = await this.correctSkew(processedBuffer);
            break;
        }
      } catch (error) {
        console.error(`Failed to apply improvement ${improvement.type}:`, error);
      }
    }

    return processedBuffer;
  }

  private async enhanceContrast(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .normalize()
      .modulate({ contrast: 1.2 })
      .png()
      .toBuffer();
  }

  private async reduceNoise(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .median(3) // Apply median filter
      .png()
      .toBuffer();
  }

  private async correctSkew(buffer: Buffer): Promise<Buffer> {
    // Mock skew correction - in real implementation would detect and correct angle
    const skewAngle = await this.detectSkew(buffer);
    
    if (Math.abs(skewAngle) > 0.5) {
      return await sharp(buffer)
        .rotate(-skewAngle, { background: '#ffffff' })
        .png()
        .toBuffer();
    }
    
    return buffer;
  }

  // Configuration
  updateQualityThresholds(thresholds: Partial<typeof this.qualityThresholds>): void {
    this.qualityThresholds = { ...this.qualityThresholds, ...thresholds };
    this.emit('thresholdsUpdated', { thresholds: this.qualityThresholds });
  }

  updateWeights(weights: Partial<typeof this.weights>): void {
    this.weights = { ...this.weights, ...weights };
    this.emit('weightsUpdated', { weights: this.weights });
  }

  getQualityThresholds(): typeof this.qualityThresholds {
    return { ...this.qualityThresholds };
  }

  getWeights(): typeof this.weights {
    return { ...this.weights };
  }
}
