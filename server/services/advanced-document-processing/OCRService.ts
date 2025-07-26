import { EventEmitter } from 'events';
import sharp from 'sharp';

export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  blocks: OCRBlock[];
  detectedLanguage: string;
  orientation: number;
  skewAngle: number;
  metadata: {
    processingTime: number;
    imageResolution: { width: number; height: number };
    preprocessingApplied: string[];
    ocrEngine: string;
    version: string;
  };
}

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  fontSize: number;
  fontStyle: string;
  language: string;
}

export interface OCRLine {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  words: OCRWord[];
  baseline: number;
  xHeight: number;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  lines: OCRLine[];
  blockType: 'paragraph' | 'heading' | 'table' | 'image' | 'separator';
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCROptions {
  language?: string[];
  dpi?: number;
  imagePreprocessing?: {
    denoise?: boolean;
    deskew?: boolean;
    enhance?: boolean;
    binarize?: boolean;
    removeBackground?: boolean;
  };
  ocrMode?: 'single_block' | 'single_column' | 'single_uniform_block' | 'single_textline' | 'single_word' | 'circle_word' | 'single_char' | 'sparse_text' | 'sparse_text_osd' | 'raw_line';
  whitelistChars?: string;
  blacklistChars?: string;
  minimumConfidence?: number;
}

export class OCRService extends EventEmitter {
  private supportedLanguages = [
    'eng', 'vie', 'chi_sim', 'chi_tra', 'jpn', 'kor', 'tha', 'fra', 'deu', 'spa'
  ];

  private preprocessingCache = new Map<string, Buffer>();
  private ocrCache = new Map<string, OCRResult>();

  constructor() {
    super();
  }

  async performOCR(
    imageBuffer: Buffer,
    options: OCROptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(imageBuffer, options);
      
      // Check cache first
      if (this.ocrCache.has(cacheKey)) {
        this.emit('ocrCacheHit', { cacheKey });
        return this.ocrCache.get(cacheKey)!;
      }

      // Preprocess image
      const preprocessedImage = await this.preprocessImage(imageBuffer, options.imagePreprocessing);
      
      // Get image metadata
      const imageMetadata = await sharp(preprocessedImage).metadata();
      
      // Perform OCR based on document type
      const ocrResult = await this.runOCREngine(preprocessedImage, options);
      
      // Post-process results
      const processedResult = await this.postProcessOCRResult(ocrResult, options);
      
      // Add metadata
      const finalResult: OCRResult = {
        ...processedResult,
        metadata: {
          processingTime: Date.now() - startTime,
          imageResolution: { 
            width: imageMetadata.width || 0, 
            height: imageMetadata.height || 0 
          },
          preprocessingApplied: this.getAppliedPreprocessing(options.imagePreprocessing),
          ocrEngine: 'Tesseract-Vietnamese-Enhanced',
          version: '5.3.1'
        }
      };

      // Cache result
      this.ocrCache.set(cacheKey, finalResult);
      
      this.emit('ocrCompleted', { 
        confidence: finalResult.confidence,
        detectedLanguage: finalResult.detectedLanguage,
        processingTime: finalResult.metadata.processingTime
      });

      return finalResult;

    } catch (error) {
      this.emit('ocrError', { error: error.message });
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  private async preprocessImage(
    imageBuffer: Buffer,
    preprocessing?: OCROptions['imagePreprocessing']
  ): Promise<Buffer> {
    if (!preprocessing) return imageBuffer;

    let processedImage = sharp(imageBuffer);

    // Apply preprocessing steps
    if (preprocessing.denoise) {
      // Apply noise reduction
      processedImage = processedImage.median(3);
    }

    if (preprocessing.enhance) {
      // Enhance contrast and sharpness
      processedImage = processedImage
        .modulate({ contrast: 1.2, brightness: 1.1 })
        .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 });
    }

    if (preprocessing.binarize) {
      // Convert to grayscale and apply threshold
      processedImage = processedImage
        .grayscale()
        .normalise()
        .threshold(128);
    }

    if (preprocessing.removeBackground) {
      // Remove background for better text detection
      processedImage = processedImage.normalise({ lower: 5, upper: 95 });
    }

    const result = await processedImage.png().toBuffer();

    // Handle deskewing separately as it requires different approach
    if (preprocessing.deskew) {
      return await this.deskewImage(result);
    }

    return result;
  }

  private async deskewImage(imageBuffer: Buffer): Promise<Buffer> {
    // Detect skew angle and rotate image
    const skewAngle = await this.detectSkewAngle(imageBuffer);
    
    if (Math.abs(skewAngle) > 0.5) {
      return await sharp(imageBuffer)
        .rotate(-skewAngle, { background: '#ffffff' })
        .png()
        .toBuffer();
    }

    return imageBuffer;
  }

  private async detectSkewAngle(imageBuffer: Buffer): Promise<number> {
    // Mock skew detection - in real implementation would use Hough transform
    // or edge detection algorithms
    const mockAngles = [-2.3, -1.1, -0.5, 0, 0.5, 1.2, 2.1];
    return mockAngles[Math.floor(Math.random() * mockAngles.length)];
  }

  private async runOCREngine(
    imageBuffer: Buffer,
    options: OCROptions
  ): Promise<OCRResult> {
    // Mock OCR engine - in real implementation would use Tesseract.js or cloud OCR
    const mockVietnameseTexts = [
      {
        text: "BỆNH VIỆN BẠCH MAI\nHÓA ĐƠN VIỆN PHÍ\nSố: 123456789\nNgày: 15/01/2024\nBệnh nhân: Nguyễn Văn A\nĐịa chỉ: Hà Nội\nChuẩn đoán: Viêm phổi\nTổng tiền: 2.500.000 VNĐ",
        confidence: 0.92,
        detectedLanguage: 'vie'
      },
      {
        text: "ĐƠN THUỐC\nBác sĩ: Trần Thị B\nChuyên khoa: Nội tổng hợp\nThuốc:\n1. Augmentin 625mg - 2 viên x 3 lần/ngày\n2. Paracetamol 500mg - 1 viên khi sốt\n3. Bisolvon 8mg - 1 viên x 2 lần/ngày\nGhi chú: Uống sau ăn",
        confidence: 0.89,
        detectedLanguage: 'vie'
      },
      {
        text: "KẾT QUẢ XÉT NGHIỆM\nMã BN: BM2024001\nNgày xét nghiệm: 14/01/2024\nHemoglobin: 12.5 g/dL (12-16)\nHematocrit: 38% (36-46)\nWBC: 8,500/μL (4,000-11,000)\nTất cả chỉ số trong giới hạn bình thường",
        confidence: 0.94,
        detectedLanguage: 'vie'
      }
    ];

    const selectedText = mockVietnameseTexts[Math.floor(Math.random() * mockVietnameseTexts.length)];
    
    // Generate words, lines, and blocks from text
    const words = this.generateWordsFromText(selectedText.text);
    const lines = this.generateLinesFromWords(words);
    const blocks = this.generateBlocksFromLines(lines);

    return {
      text: selectedText.text,
      confidence: selectedText.confidence,
      words,
      lines,
      blocks,
      detectedLanguage: selectedText.detectedLanguage,
      orientation: 0,
      skewAngle: 0,
      metadata: {
        processingTime: 0,
        imageResolution: { width: 0, height: 0 },
        preprocessingApplied: [],
        ocrEngine: '',
        version: ''
      }
    };
  }

  private generateWordsFromText(text: string): OCRWord[] {
    const words: OCRWord[] = [];
    const lines = text.split('\n');
    let currentY = 50;

    lines.forEach((line, lineIndex) => {
      const lineWords = line.split(' ').filter(word => word.trim());
      let currentX = 50;

      lineWords.forEach((word, wordIndex) => {
        words.push({
          text: word,
          confidence: 0.85 + Math.random() * 0.1,
          boundingBox: {
            x: currentX,
            y: currentY,
            width: word.length * 12,
            height: 20
          },
          fontSize: 12,
          fontStyle: 'normal',
          language: 'vie'
        });
        
        currentX += word.length * 12 + 10;
      });

      currentY += 25;
    });

    return words;
  }

  private generateLinesFromWords(words: OCRWord[]): OCRLine[] {
    const lines: OCRLine[] = [];
    const groupedWords = new Map<number, OCRWord[]>();

    // Group words by Y position (line)
    words.forEach(word => {
      const y = Math.round(word.boundingBox.y / 25) * 25;
      if (!groupedWords.has(y)) {
        groupedWords.set(y, []);
      }
      groupedWords.get(y)!.push(word);
    });

    // Create lines from grouped words
    groupedWords.forEach((lineWords, y) => {
      const sortedWords = lineWords.sort((a, b) => a.boundingBox.x - b.boundingBox.x);
      const lineText = sortedWords.map(w => w.text).join(' ');
      const avgConfidence = sortedWords.reduce((sum, w) => sum + w.confidence, 0) / sortedWords.length;
      
      const minX = Math.min(...sortedWords.map(w => w.boundingBox.x));
      const maxX = Math.max(...sortedWords.map(w => w.boundingBox.x + w.boundingBox.width));

      lines.push({
        text: lineText,
        confidence: avgConfidence,
        boundingBox: {
          x: minX,
          y: y,
          width: maxX - minX,
          height: 20
        },
        words: sortedWords,
        baseline: y + 16,
        xHeight: 12
      });
    });

    return lines.sort((a, b) => a.boundingBox.y - b.boundingBox.y);
  }

  private generateBlocksFromLines(lines: OCRLine[]): OCRBlock[] {
    const blocks: OCRBlock[] = [];
    let currentBlock: OCRLine[] = [];
    let lastY = 0;

    lines.forEach((line, index) => {
      const gap = line.boundingBox.y - lastY;
      
      // Start new block if gap is large or this is first line
      if (gap > 35 || index === 0) {
        if (currentBlock.length > 0) {
          blocks.push(this.createBlockFromLines(currentBlock));
        }
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
      
      lastY = line.boundingBox.y + line.boundingBox.height;
    });

    // Add final block
    if (currentBlock.length > 0) {
      blocks.push(this.createBlockFromLines(currentBlock));
    }

    return blocks;
  }

  private createBlockFromLines(lines: OCRLine[]): OCRBlock {
    const blockText = lines.map(l => l.text).join('\n');
    const avgConfidence = lines.reduce((sum, l) => sum + l.confidence, 0) / lines.length;
    
    const minX = Math.min(...lines.map(l => l.boundingBox.x));
    const minY = Math.min(...lines.map(l => l.boundingBox.y));
    const maxX = Math.max(...lines.map(l => l.boundingBox.x + l.boundingBox.width));
    const maxY = Math.max(...lines.map(l => l.boundingBox.y + l.boundingBox.height));

    // Determine block type based on content
    let blockType: OCRBlock['blockType'] = 'paragraph';
    if (blockText.includes('HÓA ĐƠN') || blockText.includes('ĐƠN THUỐC')) {
      blockType = 'heading';
    }

    return {
      text: blockText,
      confidence: avgConfidence,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      lines,
      blockType
    };
  }

  private async postProcessOCRResult(
    result: OCRResult,
    options: OCROptions
  ): Promise<OCRResult> {
    // Apply confidence threshold
    if (options.minimumConfidence) {
      result.words = result.words.filter(word => word.confidence >= options.minimumConfidence);
      result.lines = result.lines.map(line => ({
        ...line,
        words: line.words.filter(word => word.confidence >= options.minimumConfidence)
      })).filter(line => line.words.length > 0);
    }

    // Vietnamese text correction
    if (result.detectedLanguage === 'vie') {
      result.text = await this.correctVietnameseText(result.text);
    }

    // Apply character whitelist/blacklist
    if (options.whitelistChars || options.blacklistChars) {
      result.text = this.filterCharacters(result.text, options.whitelistChars, options.blacklistChars);
    }

    return result;
  }

  private async correctVietnameseText(text: string): Promise<string> {
    // Vietnamese-specific text corrections
    const corrections = new Map([
      ['0', 'O'],
      ['1', 'I'],
      ['5', 'S'],
      ['8', 'B'],
      ['rn', 'm'],
      ['cl', 'd'],
      ['VND', 'VNĐ'],
      ['BENH VIEN', 'BỆNH VIỆN'],
      ['HOA DON', 'HÓA ĐƠN'],
      ['DON THUOC', 'ĐƠN THUỐC']
    ]);

    let correctedText = text;
    corrections.forEach((replacement, pattern) => {
      correctedText = correctedText.replace(new RegExp(pattern, 'gi'), replacement);
    });

    return correctedText;
  }

  private filterCharacters(
    text: string,
    whitelist?: string,
    blacklist?: string
  ): string {
    if (whitelist) {
      return text.split('').filter(char => whitelist.includes(char)).join('');
    }
    
    if (blacklist) {
      return text.split('').filter(char => !blacklist.includes(char)).join('');
    }

    return text;
  }

  private generateCacheKey(imageBuffer: Buffer, options: OCROptions): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(imageBuffer);
    hash.update(JSON.stringify(options));
    return hash.digest('hex');
  }

  private getAppliedPreprocessing(preprocessing?: OCROptions['imagePreprocessing']): string[] {
    if (!preprocessing) return [];
    
    const applied: string[] = [];
    if (preprocessing.denoise) applied.push('denoise');
    if (preprocessing.deskew) applied.push('deskew');
    if (preprocessing.enhance) applied.push('enhance');
    if (preprocessing.binarize) applied.push('binarize');
    if (preprocessing.removeBackground) applied.push('removeBackground');
    
    return applied;
  }

  // Batch OCR processing
  async processBatchOCR(
    imageBuffers: Buffer[],
    options: OCROptions = {}
  ): Promise<OCRResult[]> {
    const results = await Promise.all(
      imageBuffers.map(buffer => this.performOCR(buffer, options))
    );

    this.emit('batchOCRCompleted', {
      totalImages: imageBuffers.length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    });

    return results;
  }

  // Extract text from specific regions
  async extractTextFromRegion(
    imageBuffer: Buffer,
    region: BoundingBox,
    options: OCROptions = {}
  ): Promise<OCRResult> {
    // Crop image to specified region
    const croppedImage = await sharp(imageBuffer)
      .extract({
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height
      })
      .png()
      .toBuffer();

    return await this.performOCR(croppedImage, options);
  }

  // Get supported languages
  getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  // Clear caches
  clearCaches(): void {
    this.preprocessingCache.clear();
    this.ocrCache.clear();
    this.emit('cachesCleared');
  }
}
