import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import {
  AIComponent,
  ComponentStatus,
  PerformanceMetrics,
  SimilarityResult,
  SimilarDocument,
  DuplicateDocument,
  DocumentFingerprint,
  MatchType,
  DuplicateType,
  SimilarityMetadata,
  DocumentFeatures
} from '../models/interfaces';

export interface SimilarityConfig {
  enableStructuralSimilarity: boolean;
  enableContentSimilarity: boolean;
  enableVisualSimilarity: boolean;
  enableSemanticSimilarity: boolean;
  enableFuzzyMatching: boolean;
  duplicateThreshold: number;
  similarityThreshold: number;
  maxComparisons: number;
  useApproximateSearch: boolean;
}

export interface SimilarityIndex {
  documentId: string;
  fingerprint: DocumentFingerprint;
  features: DocumentFeatures;
  metadata: DocumentIndexMetadata;
  timestamp: Date;
}

export interface DocumentIndexMetadata {
  documentType: string;
  language: string;
  source: string;
  size: number;
  pageCount: number;
  processingVersion: string;
}

export interface SemanticEmbedding {
  vector: number[];
  dimension: number;
  model: string;
  confidence: number;
}

export interface PerceptualHash {
  hash: string;
  algorithm: 'dHash' | 'pHash' | 'aHash';
  blockSize: number;
  confidence: number;
}

export interface TextNGrams {
  unigrams: Map<string, number>;
  bigrams: Map<string, number>;
  trigrams: Map<string, number>;
  characterNGrams: Map<string, number>;
}

export interface SimilarityMetrics {
  structuralSimilarity: number;
  contentSimilarity: number;
  visualSimilarity: number;
  semanticSimilarity: number;
  overallSimilarity: number;
  confidence: number;
}

export interface LSHIndex {
  bands: number;
  rowsPerBand: number;
  hashTables: Map<string, Set<string>>[];
  signatures: Map<string, number[]>;
}

export class DocumentSimilarity extends EventEmitter implements AIComponent {
  private status: ComponentStatus;
  private documentIndex: Map<string, SimilarityIndex> = new Map();
  private lshIndex: LSHIndex;
  private config: SimilarityConfig;
  private semanticModel: any = null; // Would be actual embedding model
  private vietnameseStopWords: Set<string> = new Set();
  private medicalTermWeights: Map<string, number> = new Map();
  private similarityCache: Map<string, SimilarityMetrics> = new Map();

  constructor(config: SimilarityConfig) {
    super();
    this.config = config;
    this.status = {
      isReady: false,
      isProcessing: false,
      uptime: 0,
      totalProcessed: 0
    };
    
    // Initialize LSH for approximate similarity search
    this.lshIndex = {
      bands: 20,
      rowsPerBand: 5,
      hashTables: Array.from({ length: 20 }, () => new Map()),
      signatures: new Map()
    };
  }

  async initialize(): Promise<void> {
    try {
      this.emit('initialization_started');
      
      // Load Vietnamese stop words
      await this.loadVietnameseStopWords();
      
      // Load medical term weights
      await this.loadMedicalTermWeights();
      
      // Initialize semantic embedding model
      await this.initializeSemanticModel();
      
      // Load existing document index if available
      await this.loadExistingIndex();
      
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
      return await this.findSimilarDocuments(input, options);
    }
    throw new Error('Invalid input type for DocumentSimilarity');
  }

  getStatus(): ComponentStatus {
    return { ...this.status };
  }

  getMetrics(): PerformanceMetrics {
    return {
      inferenceTime: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: 0,
      accuracy: 0.95, // Mock accuracy
      precision: 0.92,
      recall: 0.89,
      f1Score: 0.91
    };
  }

  async findSimilarDocuments(
    documentBuffer: Buffer,
    options: {
      documentId?: string;
      features?: DocumentFeatures;
      extractedText?: string;
      maxResults?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SimilarityResult> {
    const startTime = Date.now();
    this.status.isProcessing = true;

    try {
      this.emit('similarity_search_started', { 
        documentSize: documentBuffer.length,
        indexSize: this.documentIndex.size 
      });

      // Generate fingerprint for query document
      const queryFingerprint = await this.generateDocumentFingerprint(
        documentBuffer,
        options.features,
        options.extractedText
      );

      // Find similar documents using different algorithms
      const similarDocuments = await this.searchSimilarDocuments(
        queryFingerprint,
        options.maxResults || 10,
        options.minSimilarity || this.config.similarityThreshold
      );

      // Find duplicate documents
      const duplicateDocuments = await this.findDuplicates(
        queryFingerprint,
        this.config.duplicateThreshold
      );

      // Add query document to index if not already present
      if (options.documentId) {
        await this.addToIndex(options.documentId, queryFingerprint, options.features);
      }

      const result: SimilarityResult = {
        similarDocuments,
        duplicateDocuments,
        fingerprint: queryFingerprint,
        metadata: {
          algorithm: 'multimodal_similarity',
          threshold: this.config.similarityThreshold,
          comparisonsPerformed: this.documentIndex.size,
          processingTime: Date.now() - startTime
        }
      };

      this.status.totalProcessed++;
      this.emit('similarity_search_completed', {
        similarCount: similarDocuments.length,
        duplicateCount: duplicateDocuments.length,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.emit('similarity_search_failed', { error: error.message });
      throw error;
    } finally {
      this.status.isProcessing = false;
    }
  }

  async generateDocumentFingerprint(
    documentBuffer: Buffer,
    features?: DocumentFeatures,
    extractedText?: string
  ): Promise<DocumentFingerprint> {
    this.emit('fingerprint_generation_started');

    // Generate structural hash
    const structuralHash = await this.generateStructuralHash(features);
    
    // Generate content hash
    const contentHash = await this.generateContentHash(extractedText || '');
    
    // Generate visual hash
    const visualHash = await this.generateVisualHash(documentBuffer);
    
    // Generate metadata hash
    const metadataHash = await this.generateMetadataHash(features);
    
    // Generate semantic embedding
    const semanticEmbedding = await this.generateSemanticEmbedding(extractedText || '');

    const fingerprint: DocumentFingerprint = {
      structuralHash,
      contentHash,
      visualHash,
      metadataHash,
      semanticEmbedding
    };

    this.emit('fingerprint_generation_completed', {
      embeddingDimension: semanticEmbedding.length
    });

    return fingerprint;
  }

  private async generateStructuralHash(features?: DocumentFeatures): Promise<string> {
    if (!features) {
      return crypto.randomBytes(16).toString('hex');
    }

    const structuralFeatures = {
      hasHeader: features.structuralFeatures.hasHeader,
      hasFooter: features.structuralFeatures.hasFooter,
      hasTitle: features.structuralFeatures.hasTitle,
      sectionCount: Math.floor(features.structuralFeatures.sectionCount / 2), // Quantize
      paragraphCount: Math.floor(features.structuralFeatures.paragraphCount / 5),
      listCount: features.structuralFeatures.listCount,
      formFieldCount: Math.floor(features.structuralFeatures.formFieldCount / 3),
      columnCount: features.visualFeatures.layout.columnCount,
      hasTable: features.visualFeatures.hasTable,
      hasLogo: features.visualFeatures.hasLogo,
      hasSignature: features.visualFeatures.hasSignature
    };

    return crypto.createHash('md5')
      .update(JSON.stringify(structuralFeatures))
      .digest('hex');
  }

  private async generateContentHash(text: string): Promise<string> {
    if (!text.trim()) {
      return crypto.randomBytes(16).toString('hex');
    }

    // Normalize text for content hashing
    const normalizedText = await this.normalizeTextForHashing(text);
    
    // Generate n-grams for robust content comparison
    const ngrams = this.generateNGrams(normalizedText);
    
    // Create content signature from important n-grams
    const importantNGrams = this.selectImportantNGrams(ngrams);
    
    return crypto.createHash('md5')
      .update(JSON.stringify(importantNGrams))
      .digest('hex');
  }

  private async generateVisualHash(documentBuffer: Buffer): Promise<string> {
    // Generate perceptual hash for visual similarity
    // In real implementation, would use image processing library
    
    // Mock perceptual hash generation
    const hash = crypto.createHash('sha256');
    hash.update(documentBuffer.slice(0, 1024)); // Use first 1KB for quick hashing
    hash.update('visual_features'); // Add visual feature marker
    
    return hash.digest('hex').substring(0, 16);
  }

  private async generateMetadataHash(features?: DocumentFeatures): Promise<string> {
    if (!features) {
      return crypto.randomBytes(16).toString('hex');
    }

    const metadataFeatures = {
      language: features.textFeatures.language,
      pageCount: features.metadataFeatures.pageCount,
      fileSize: Math.floor(features.metadataFeatures.fileSize / 10000), // Quantize
      isScanned: features.metadataFeatures.isScanned,
      hasFormFields: features.metadataFeatures.hasFormFields,
      colorDepth: features.metadataFeatures.colorDepth
    };

    return crypto.createHash('md5')
      .update(JSON.stringify(metadataFeatures))
      .digest('hex');
  }

  private async generateSemanticEmbedding(text: string): Promise<number[]> {
    if (!text.trim()) {
      return Array.from({ length: 384 }, () => Math.random() - 0.5);
    }

    // Mock semantic embedding generation
    // In real implementation, would use sentence transformers or similar
    
    // Generate text-based features
    const words = text.toLowerCase()
      .replace(/[^\wàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.vietnameseStopWords.has(word));

    // Create bag-of-words embedding with medical term weighting
    const embedding = Array.from({ length: 384 }, () => 0);
    
    words.forEach((word, index) => {
      const weight = this.medicalTermWeights.get(word) || 1.0;
      const position = this.hashStringToIndex(word, 384);
      embedding[position] += weight;
    });

    // Normalize embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  private async searchSimilarDocuments(
    queryFingerprint: DocumentFingerprint,
    maxResults: number,
    minSimilarity: number
  ): Promise<SimilarDocument[]> {
    const similarities: Array<{
      documentId: string;
      similarity: SimilarityMetrics;
    }> = [];

    // Use LSH for approximate search if enabled and index is large
    if (this.config.useApproximateSearch && this.documentIndex.size > 1000) {
      const candidates = await this.getLSHCandidates(queryFingerprint);
      
      for (const documentId of candidates) {
        const indexEntry = this.documentIndex.get(documentId);
        if (!indexEntry) continue;
        
        const similarity = await this.calculateSimilarity(
          queryFingerprint,
          indexEntry.fingerprint
        );
        
        if (similarity.overallSimilarity >= minSimilarity) {
          similarities.push({ documentId, similarity });
        }
      }
    } else {
      // Exhaustive search for smaller indices
      for (const [documentId, indexEntry] of this.documentIndex.entries()) {
        const similarity = await this.calculateSimilarity(
          queryFingerprint,
          indexEntry.fingerprint
        );
        
        if (similarity.overallSimilarity >= minSimilarity) {
          similarities.push({ documentId, similarity });
        }
      }
    }

    // Sort by similarity and return top results
    similarities.sort((a, b) => b.similarity.overallSimilarity - a.similarity.overallSimilarity);
    
    return similarities.slice(0, maxResults).map(({ documentId, similarity }) => ({
      documentId,
      similarity: similarity.overallSimilarity,
      matchType: this.determineMatchType(similarity),
      confidence: similarity.confidence,
      matchedFeatures: this.getMatchedFeatures(similarity)
    }));
  }

  private async findDuplicates(
    queryFingerprint: DocumentFingerprint,
    threshold: number
  ): Promise<DuplicateDocument[]> {
    const duplicates: DuplicateDocument[] = [];

    for (const [documentId, indexEntry] of this.documentIndex.entries()) {
      const similarity = await this.calculateSimilarity(
        queryFingerprint,
        indexEntry.fingerprint
      );

      if (similarity.overallSimilarity >= threshold) {
        duplicates.push({
          documentId,
          similarity: similarity.overallSimilarity,
          isDuplicate: similarity.overallSimilarity >= 0.95,
          confidence: similarity.confidence,
          duplicateType: this.determineDuplicateType(similarity)
        });
      }
    }

    return duplicates.sort((a, b) => b.similarity - a.similarity);
  }

  private async calculateSimilarity(
    fingerprint1: DocumentFingerprint,
    fingerprint2: DocumentFingerprint
  ): Promise<SimilarityMetrics> {
    // Check cache first
    const cacheKey = this.getCacheKey(fingerprint1, fingerprint2);
    const cached = this.similarityCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate different types of similarity
    const structuralSimilarity = this.config.enableStructuralSimilarity
      ? this.calculateStructuralSimilarity(fingerprint1, fingerprint2)
      : 0;

    const contentSimilarity = this.config.enableContentSimilarity
      ? this.calculateContentSimilarity(fingerprint1, fingerprint2)
      : 0;

    const visualSimilarity = this.config.enableVisualSimilarity
      ? this.calculateVisualSimilarity(fingerprint1, fingerprint2)
      : 0;

    const semanticSimilarity = this.config.enableSemanticSimilarity
      ? this.calculateSemanticSimilarity(fingerprint1, fingerprint2)
      : 0;

    // Weighted combination
    const weights = {
      structural: 0.2,
      content: 0.4,
      visual: 0.2,
      semantic: 0.2
    };

    const overallSimilarity = (
      structuralSimilarity * weights.structural +
      contentSimilarity * weights.content +
      visualSimilarity * weights.visual +
      semanticSimilarity * weights.semantic
    );

    const confidence = this.calculateConfidence(
      structuralSimilarity,
      contentSimilarity,
      visualSimilarity,
      semanticSimilarity
    );

    const metrics: SimilarityMetrics = {
      structuralSimilarity,
      contentSimilarity,
      visualSimilarity,
      semanticSimilarity,
      overallSimilarity,
      confidence
    };

    // Cache result
    this.similarityCache.set(cacheKey, metrics);
    
    // Limit cache size
    if (this.similarityCache.size > 10000) {
      const firstKey = this.similarityCache.keys().next().value;
      this.similarityCache.delete(firstKey);
    }

    return metrics;
  }

  private calculateStructuralSimilarity(
    fp1: DocumentFingerprint,
    fp2: DocumentFingerprint
  ): number {
    // Hamming distance for structural hash
    return fp1.structuralHash === fp2.structuralHash ? 1.0 : 0.0;
  }

  private calculateContentSimilarity(
    fp1: DocumentFingerprint,
    fp2: DocumentFingerprint
  ): number {
    // Hamming distance for content hash
    return fp1.contentHash === fp2.contentHash ? 1.0 : 0.0;
  }

  private calculateVisualSimilarity(
    fp1: DocumentFingerprint,
    fp2: DocumentFingerprint
  ): number {
    // Hamming distance for visual hash
    const hash1 = fp1.visualHash;
    const hash2 = fp2.visualHash;
    
    if (hash1.length !== hash2.length) return 0.0;
    
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }
    
    return 1.0 - (differences / hash1.length);
  }

  private calculateSemanticSimilarity(
    fp1: DocumentFingerprint,
    fp2: DocumentFingerprint
  ): number {
    // Cosine similarity for semantic embeddings
    const vec1 = fp1.semanticEmbedding;
    const vec2 = fp2.semanticEmbedding;
    
    if (vec1.length !== vec2.length) return 0.0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0.0;
  }

  private calculateConfidence(
    structural: number,
    content: number,
    visual: number,
    semantic: number
  ): number {
    // Confidence based on agreement between different similarity measures
    const values = [structural, content, visual, semantic].filter(v => v > 0);
    if (values.length === 0) return 0.0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    return Math.max(0.1, 1.0 - standardDeviation);
  }

  private determineMatchType(similarity: SimilarityMetrics): MatchType {
    if (similarity.overallSimilarity >= 0.98) return 'EXACT';
    if (similarity.visualSimilarity >= 0.9) return 'SIMILAR_VISUAL';
    if (similarity.contentSimilarity >= 0.9) return 'SIMILAR_CONTENT';
    if (similarity.structuralSimilarity >= 0.9) return 'SIMILAR_STRUCTURE';
    return 'NEAR_DUPLICATE';
  }

  private determineDuplicateType(similarity: SimilarityMetrics): DuplicateType {
    if (similarity.overallSimilarity >= 0.99) return 'IDENTICAL';
    if (similarity.overallSimilarity >= 0.95) return 'NEAR_IDENTICAL';
    if (similarity.contentSimilarity >= 0.9) return 'RESUBMISSION';
    return 'ALTERED_COPY';
  }

  private getMatchedFeatures(similarity: SimilarityMetrics): string[] {
    const features: string[] = [];
    
    if (similarity.structuralSimilarity >= 0.8) features.push('structure');
    if (similarity.contentSimilarity >= 0.8) features.push('content');
    if (similarity.visualSimilarity >= 0.8) features.push('visual');
    if (similarity.semanticSimilarity >= 0.8) features.push('semantic');
    
    return features;
  }

  // Helper methods
  private async normalizeTextForHashing(text: string): Promise<string> {
    // Normalize text for consistent hashing
    let normalized = text.toLowerCase();
    
    // Remove common OCR errors and noise
    normalized = normalized
      .replace(/[^\wàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove stop words
    const words = normalized.split(/\s+/).filter(word => 
      word.length > 2 && !this.vietnameseStopWords.has(word)
    );
    
    return words.join(' ');
  }

  private generateNGrams(text: string): TextNGrams {
    const words = text.split(/\s+/);
    const unigrams = new Map<string, number>();
    const bigrams = new Map<string, number>();
    const trigrams = new Map<string, number>();
    const characterNGrams = new Map<string, number>();
    
    // Word n-grams
    for (let i = 0; i < words.length; i++) {
      // Unigrams
      const word = words[i];
      unigrams.set(word, (unigrams.get(word) || 0) + 1);
      
      // Bigrams
      if (i < words.length - 1) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
      }
      
      // Trigrams
      if (i < words.length - 2) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        trigrams.set(trigram, (trigrams.get(trigram) || 0) + 1);
      }
    }
    
    // Character n-grams
    const cleanText = text.replace(/\s+/g, '');
    for (let i = 0; i < cleanText.length - 2; i++) {
      const charNGram = cleanText.substring(i, i + 3);
      characterNGrams.set(charNGram, (characterNGrams.get(charNGram) || 0) + 1);
    }
    
    return { unigrams, bigrams, trigrams, characterNGrams };
  }

  private selectImportantNGrams(ngrams: TextNGrams): any {
    // Select most frequent and medically important n-grams
    const importantUnigrams = Array.from(ngrams.unigrams.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word, count]) => ({ 
        word, 
        count, 
        weight: this.medicalTermWeights.get(word) || 1.0 
      }));
    
    const importantBigrams = Array.from(ngrams.bigrams.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([bigram, count]) => ({ bigram, count }));
    
    return {
      unigrams: importantUnigrams,
      bigrams: importantBigrams
    };
  }

  private hashStringToIndex(str: string, maxIndex: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % maxIndex;
  }

  private getCacheKey(fp1: DocumentFingerprint, fp2: DocumentFingerprint): string {
    // Create deterministic cache key
    const key1 = `${fp1.structuralHash}${fp1.contentHash}`;
    const key2 = `${fp2.structuralHash}${fp2.contentHash}`;
    
    return key1 < key2 ? `${key1}:${key2}` : `${key2}:${key1}`;
  }

  private async getLSHCandidates(fingerprint: DocumentFingerprint): Promise<Set<string>> {
    // LSH-based approximate similarity search
    const candidates = new Set<string>();
    const signature = await this.generateMinHashSignature(fingerprint.semanticEmbedding);
    
    // Check each band
    for (let band = 0; band < this.lshIndex.bands; band++) {
      const bandStart = band * this.lshIndex.rowsPerBand;
      const bandEnd = bandStart + this.lshIndex.rowsPerBand;
      const bandSignature = signature.slice(bandStart, bandEnd).join(',');
      
      const bucket = this.lshIndex.hashTables[band].get(bandSignature);
      if (bucket) {
        bucket.forEach(docId => candidates.add(docId));
      }
    }
    
    return candidates;
  }

  private async generateMinHashSignature(embedding: number[]): Promise<number[]> {
    // Generate MinHash signature for LSH
    const signature: number[] = [];
    const numHashes = this.lshIndex.bands * this.lshIndex.rowsPerBand;
    
    for (let i = 0; i < numHashes; i++) {
      let minHash = Infinity;
      for (let j = 0; j < embedding.length; j++) {
        const hash = this.simpleHash(embedding[j] * 1000 + i);
        minHash = Math.min(minHash, hash);
      }
      signature.push(minHash);
    }
    
    return signature;
  }

  private simpleHash(value: number): number {
    // Simple hash function for MinHash
    let hash = Math.abs(Math.floor(value));
    hash = ((hash << 5) - hash + hash) & 0xffffffff;
    return hash;
  }

  // Initialization methods
  private async loadVietnameseStopWords(): Promise<void> {
    const stopWords = [
      'và', 'của', 'có', 'là', 'với', 'được', 'cho', 'từ', 'trong', 'như',
      'để', 'về', 'theo', 'sau', 'trên', 'dưới', 'giữa', 'bên', 'cùng', 'ngoài',
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
    ];
    
    stopWords.forEach(word => this.vietnameseStopWords.add(word));
    this.emit('stop_words_loaded', { count: stopWords.length });
  }

  private async loadMedicalTermWeights(): Promise<void> {
    // Assign higher weights to medical terms
    const medicalTerms = new Map([
      ['bệnh viện', 3.0],
      ['phòng khám', 2.5],
      ['bác sĩ', 2.8],
      ['chẩn đoán', 2.7],
      ['điều trị', 2.6],
      ['thuốc', 2.5],
      ['xét nghiệm', 2.4],
      ['phẫu thuật', 2.9],
      ['cấp cứu', 2.8],
      ['hóa đơn', 2.2],
      ['viện phí', 2.1],
      ['bảo hiểm', 2.3],
      ['hemoglobin', 2.0],
      ['glucose', 2.0],
      ['cholesterol', 2.0],
      ['creatinine', 2.0],
      ['prescription', 2.5],
      ['diagnosis', 2.7],
      ['treatment', 2.6],
      ['hospital', 3.0]
    ]);
    
    this.medicalTermWeights = medicalTerms;
    this.emit('medical_terms_weighted', { count: medicalTerms.size });
  }

  private async initializeSemanticModel(): Promise<void> {
    // Mock semantic model initialization
    this.semanticModel = {
      model: 'vietnamese_medical_embeddings_v1',
      dimension: 384,
      vocabulary: 50000
    };
    
    this.emit('semantic_model_initialized');
  }

  private async loadExistingIndex(): Promise<void> {
    // Mock loading existing index from storage
    this.emit('existing_index_loaded', { documentCount: this.documentIndex.size });
  }

  // Public API methods
  async addToIndex(
    documentId: string,
    fingerprint: DocumentFingerprint,
    features?: DocumentFeatures
  ): Promise<void> {
    const indexEntry: SimilarityIndex = {
      documentId,
      fingerprint,
      features: features || {} as DocumentFeatures,
      metadata: {
        documentType: 'unknown',
        language: 'vietnamese',
        source: 'upload',
        size: 0,
        pageCount: 1,
        processingVersion: '1.0.0'
      },
      timestamp: new Date()
    };

    this.documentIndex.set(documentId, indexEntry);
    
    // Add to LSH index
    await this.addToLSHIndex(documentId, fingerprint);
    
    this.emit('document_indexed', { 
      documentId, 
      indexSize: this.documentIndex.size 
    });
  }

  private async addToLSHIndex(documentId: string, fingerprint: DocumentFingerprint): Promise<void> {
    const signature = await this.generateMinHashSignature(fingerprint.semanticEmbedding);
    this.lshIndex.signatures.set(documentId, signature);
    
    // Add to hash tables
    for (let band = 0; band < this.lshIndex.bands; band++) {
      const bandStart = band * this.lshIndex.rowsPerBand;
      const bandEnd = bandStart + this.lshIndex.rowsPerBand;
      const bandSignature = signature.slice(bandStart, bandEnd).join(',');
      
      if (!this.lshIndex.hashTables[band].has(bandSignature)) {
        this.lshIndex.hashTables[band].set(bandSignature, new Set());
      }
      this.lshIndex.hashTables[band].get(bandSignature)!.add(documentId);
    }
  }

  async removeFromIndex(documentId: string): Promise<void> {
    const removed = this.documentIndex.delete(documentId);
    
    if (removed) {
      // Remove from LSH index
      await this.removeFromLSHIndex(documentId);
      
      this.emit('document_removed_from_index', { 
        documentId, 
        indexSize: this.documentIndex.size 
      });
    }
  }

  private async removeFromLSHIndex(documentId: string): Promise<void> {
    const signature = this.lshIndex.signatures.get(documentId);
    if (!signature) return;
    
    // Remove from hash tables
    for (let band = 0; band < this.lshIndex.bands; band++) {
      const bandStart = band * this.lshIndex.rowsPerBand;
      const bandEnd = bandStart + this.lshIndex.rowsPerBand;
      const bandSignature = signature.slice(bandStart, bandEnd).join(',');
      
      const bucket = this.lshIndex.hashTables[band].get(bandSignature);
      if (bucket) {
        bucket.delete(documentId);
        if (bucket.size === 0) {
          this.lshIndex.hashTables[band].delete(bandSignature);
        }
      }
    }
    
    this.lshIndex.signatures.delete(documentId);
  }

  getIndexStatistics(): any {
    return {
      totalDocuments: this.documentIndex.size,
      lshBands: this.lshIndex.bands,
      lshRowsPerBand: this.lshIndex.rowsPerBand,
      cacheSize: this.similarityCache.size,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  async clearCache(): Promise<void> {
    this.similarityCache.clear();
    this.emit('cache_cleared');
  }

  async optimizeIndex(): Promise<void> {
    // Rebuild LSH index for better performance
    const documents = Array.from(this.documentIndex.entries());
    
    // Clear existing LSH index
    this.lshIndex.hashTables.forEach(table => table.clear());
    this.lshIndex.signatures.clear();
    
    // Rebuild
    for (const [documentId, indexEntry] of documents) {
      await this.addToLSHIndex(documentId, indexEntry.fingerprint);
    }
    
    this.emit('index_optimized', { documentCount: documents.length });
  }

  updateConfig(newConfig: Partial<SimilarityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config_updated', { config: this.config });
  }

  getConfig(): SimilarityConfig {
    return { ...this.config };
  }
}
