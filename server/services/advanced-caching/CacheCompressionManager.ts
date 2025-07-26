import zlib from 'zlib';
import { promisify } from 'util';

export interface CompressionAlgorithm {
  name: string;
  compress: (data: Buffer) => Promise<Buffer>;
  decompress: (data: Buffer) => Promise<Buffer>;
  ratio: number; // Average compression ratio
  speed: number; // Compression speed score (1-10)
  cpuIntensive: boolean;
}

export interface CompressionConfig {
  algorithm: string;
  level: number; // 1-9 for most algorithms
  threshold: number; // Minimum size to compress (bytes)
  chunkSize?: number; // For streaming compression
  dictionary?: Buffer; // Pre-trained dictionary for some algorithms
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: string;
  compressionTime: number;
  decompressionTime?: number;
}

export interface CompressionStats {
  totalCompressions: number;
  totalDecompressions: number;
  totalBytesSaved: number;
  averageCompressionRatio: number;
  algorithmStats: Map<string, {
    compressions: number;
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageRatio: number;
    averageCompressionTime: number;
    averageDecompressionTime: number;
  }>;
}

export interface AdaptiveCompressionSettings {
  enabled: boolean;
  sampleSize: number;
  adaptationInterval: number; // milliseconds
  performanceWeight: number; // 0-1, balance between ratio and speed
  cpuThreshold: number; // 0-100, CPU usage threshold
}

export class CacheCompressionManager {
  private algorithms: Map<string, CompressionAlgorithm> = new Map();
  private stats: CompressionStats;
  private adaptiveSettings: AdaptiveCompressionSettings;
  private recentPerformance: Map<string, Array<{ ratio: number; time: number; timestamp: Date }>> = new Map();

  constructor() {
    this.stats = {
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0,
      algorithmStats: new Map(),
    };

    this.adaptiveSettings = {
      enabled: true,
      sampleSize: 100,
      adaptationInterval: 60000, // 1 minute
      performanceWeight: 0.7, // Favor compression ratio
      cpuThreshold: 80,
    };

    this.setupCompressionAlgorithms();
    this.startAdaptiveMonitoring();
  }

  private setupCompressionAlgorithms(): void {
    // Gzip - Good balance of speed and compression
    this.algorithms.set('gzip', {
      name: 'gzip',
      compress: promisify(zlib.gzip),
      decompress: promisify(zlib.gunzip),
      ratio: 3.5,
      speed: 7,
      cpuIntensive: false,
    });

    // Deflate - Fast compression, slightly less ratio than gzip
    this.algorithms.set('deflate', {
      name: 'deflate',
      compress: promisify(zlib.deflate),
      decompress: promisify(zlib.inflate),
      ratio: 3.2,
      speed: 8,
      cpuIntensive: false,
    });

    // Brotli - Better compression ratio, slower
    this.algorithms.set('brotli', {
      name: 'brotli',
      compress: promisify(zlib.brotliCompress),
      decompress: promisify(zlib.brotliDecompress),
      ratio: 4.2,
      speed: 5,
      cpuIntensive: true,
    });

    // Raw deflate - Fastest, least compression
    this.algorithms.set('raw', {
      name: 'raw',
      compress: promisify(zlib.deflateRaw),
      decompress: promisify(zlib.inflateRaw),
      ratio: 2.8,
      speed: 9,
      cpuIntensive: false,
    });

    // LZ4-like fast compression (using deflate with minimal compression)
    this.algorithms.set('fast', {
      name: 'fast',
      compress: async (data: Buffer) => {
        return promisify(zlib.deflate)(data, { level: 1, memLevel: 1 });
      },
      decompress: promisify(zlib.inflate),
      ratio: 2.0,
      speed: 10,
      cpuIntensive: false,
    });

    // High compression (using deflate with maximum compression)
    this.algorithms.set('high', {
      name: 'high',
      compress: async (data: Buffer) => {
        return promisify(zlib.deflate)(data, { level: 9, memLevel: 9 });
      },
      decompress: promisify(zlib.inflate),
      ratio: 4.0,
      speed: 3,
      cpuIntensive: true,
    });

    // Initialize stats for all algorithms
    for (const algorithmName of this.algorithms.keys()) {
      this.stats.algorithmStats.set(algorithmName, {
        compressions: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        averageRatio: 0,
        averageCompressionTime: 0,
        averageDecompressionTime: 0,
      });
      this.recentPerformance.set(algorithmName, []);
    }
  }

  async compress(
    data: any, 
    config: CompressionConfig
  ): Promise<{ compressedData: Buffer; metadata: CompressionResult }> {
    const algorithm = this.algorithms.get(config.algorithm);
    if (!algorithm) {
      throw new Error(`Unknown compression algorithm: ${config.algorithm}`);
    }

    // Convert data to buffer
    const buffer = this.serializeData(data);
    
    // Check if compression is worth it
    if (buffer.length < config.threshold) {
      return {
        compressedData: buffer,
        metadata: {
          originalSize: buffer.length,
          compressedSize: buffer.length,
          compressionRatio: 1.0,
          algorithm: 'none',
          compressionTime: 0,
        },
      };
    }

    const startTime = process.hrtime.bigint();
    
    try {
      const compressedBuffer = await algorithm.compress(buffer);
      const compressionTime = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to ms

      const metadata: CompressionResult = {
        originalSize: buffer.length,
        compressedSize: compressedBuffer.length,
        compressionRatio: buffer.length / compressedBuffer.length,
        algorithm: config.algorithm,
        compressionTime,
      };

      // Update statistics
      this.updateCompressionStats(metadata);

      // Only return compressed data if it's actually smaller
      if (compressedBuffer.length < buffer.length) {
        return { compressedData: compressedBuffer, metadata };
      } else {
        return {
          compressedData: buffer,
          metadata: {
            ...metadata,
            algorithm: 'none',
            compressionRatio: 1.0,
          },
        };
      }

    } catch (error) {
      console.error(`Compression failed with ${config.algorithm}:`, error);
      // Fallback to uncompressed
      return {
        compressedData: buffer,
        metadata: {
          originalSize: buffer.length,
          compressedSize: buffer.length,
          compressionRatio: 1.0,
          algorithm: 'none',
          compressionTime: 0,
        },
      };
    }
  }

  async decompress(compressedData: Buffer, algorithm: string): Promise<any> {
    if (algorithm === 'none') {
      return this.deserializeData(compressedData);
    }

    const compressionAlgorithm = this.algorithms.get(algorithm);
    if (!compressionAlgorithm) {
      throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }

    const startTime = process.hrtime.bigint();
    
    try {
      const decompressedBuffer = await compressionAlgorithm.decompress(compressedData);
      const decompressionTime = Number(process.hrtime.bigint() - startTime) / 1000000;

      // Update decompression stats
      this.updateDecompressionStats(algorithm, decompressionTime);

      return this.deserializeData(decompressedBuffer);

    } catch (error) {
      console.error(`Decompression failed with ${algorithm}:`, error);
      throw error;
    }
  }

  async compressWithBestAlgorithm(
    data: any,
    config: Omit<CompressionConfig, 'algorithm'>
  ): Promise<{ compressedData: Buffer; metadata: CompressionResult }> {
    const buffer = this.serializeData(data);
    
    if (buffer.length < config.threshold) {
      return {
        compressedData: buffer,
        metadata: {
          originalSize: buffer.length,
          compressedSize: buffer.length,
          compressionRatio: 1.0,
          algorithm: 'none',
          compressionTime: 0,
        },
      };
    }

    let bestResult: { compressedData: Buffer; metadata: CompressionResult } | null = null;
    let bestScore = 0;

    // Test a subset of algorithms based on data characteristics
    const candidateAlgorithms = this.selectCandidateAlgorithms(buffer);

    for (const algorithmName of candidateAlgorithms) {
      try {
        const result = await this.compress(data, { ...config, algorithm: algorithmName });
        const score = this.calculateAlgorithmScore(result.metadata);

        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      } catch (error) {
        console.warn(`Algorithm ${algorithmName} failed:`, error);
      }
    }

    return bestResult || {
      compressedData: buffer,
      metadata: {
        originalSize: buffer.length,
        compressedSize: buffer.length,
        compressionRatio: 1.0,
        algorithm: 'none',
        compressionTime: 0,
      },
    };
  }

  async compressAdaptive(
    data: any,
    config: Omit<CompressionConfig, 'algorithm'>
  ): Promise<{ compressedData: Buffer; metadata: CompressionResult }> {
    if (!this.adaptiveSettings.enabled) {
      return this.compress(data, { ...config, algorithm: 'gzip' });
    }

    const algorithm = this.selectAdaptiveAlgorithm();
    return this.compress(data, { ...config, algorithm });
  }

  private selectCandidateAlgorithms(buffer: Buffer): string[] {
    // Select algorithms based on data characteristics
    const dataSize = buffer.length;
    const entropy = this.calculateEntropy(buffer.slice(0, Math.min(1024, buffer.length)));

    const candidates: string[] = [];

    // For small data, prefer fast algorithms
    if (dataSize < 1024) {
      candidates.push('fast', 'deflate');
    }
    // For medium data, balance speed and compression
    else if (dataSize < 10240) {
      candidates.push('gzip', 'deflate', 'brotli');
    }
    // For large data, prefer high compression if data has low entropy
    else {
      if (entropy < 6.0) { // Low entropy, good compression potential
        candidates.push('brotli', 'high', 'gzip');
      } else { // High entropy, prefer speed
        candidates.push('fast', 'deflate', 'gzip');
      }
    }

    return candidates;
  }

  private calculateEntropy(buffer: Buffer): number {
    const frequencies = new Array(256).fill(0);
    for (let i = 0; i < buffer.length; i++) {
      frequencies[buffer[i]]++;
    }

    let entropy = 0;
    const length = buffer.length;
    for (const freq of frequencies) {
      if (freq > 0) {
        const probability = freq / length;
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  private calculateAlgorithmScore(metadata: CompressionResult): number {
    const { compressionRatio, compressionTime } = metadata;
    
    // Normalize metrics (higher is better for ratio, lower is better for time)
    const ratioScore = Math.min(compressionRatio / 5.0, 1.0); // Cap at 5:1 ratio
    const timeScore = Math.max(0, 1.0 - (compressionTime / 100.0)); // Penalty after 100ms

    // Weighted combination
    return (ratioScore * this.adaptiveSettings.performanceWeight) + 
           (timeScore * (1 - this.adaptiveSettings.performanceWeight));
  }

  private selectAdaptiveAlgorithm(): string {
    const recentWindow = Date.now() - this.adaptiveSettings.adaptationInterval;
    let bestAlgorithm = 'gzip'; // Default fallback
    let bestScore = 0;

    for (const [algorithm, performances] of this.recentPerformance) {
      const recentPerformances = performances.filter(p => p.timestamp.getTime() > recentWindow);
      
      if (recentPerformances.length < 5) continue; // Need enough samples

      const avgRatio = recentPerformances.reduce((sum, p) => sum + p.ratio, 0) / recentPerformances.length;
      const avgTime = recentPerformances.reduce((sum, p) => sum + p.time, 0) / recentPerformances.length;

      const score = this.calculateAlgorithmScore({
        originalSize: 1000, // Dummy values for scoring
        compressedSize: 1000 / avgRatio,
        compressionRatio: avgRatio,
        algorithm,
        compressionTime: avgTime,
      });

      if (score > bestScore) {
        bestScore = score;
        bestAlgorithm = algorithm;
      }
    }

    return bestAlgorithm;
  }

  private startAdaptiveMonitoring(): void {
    setInterval(() => {
      this.cleanupOldPerformanceData();
      this.adaptCompressionSettings();
    }, this.adaptiveSettings.adaptationInterval);
  }

  private cleanupOldPerformanceData(): void {
    const cutoff = Date.now() - (this.adaptiveSettings.adaptationInterval * 5); // Keep 5 intervals

    for (const [algorithm, performances] of this.recentPerformance) {
      const filtered = performances.filter(p => p.timestamp.getTime() > cutoff);
      this.recentPerformance.set(algorithm, filtered);
    }
  }

  private adaptCompressionSettings(): void {
    // Adjust settings based on recent performance and system load
    const cpuUsage = this.getCurrentCpuUsage();

    if (cpuUsage > this.adaptiveSettings.cpuThreshold) {
      // High CPU usage - prefer faster algorithms
      this.adaptiveSettings.performanceWeight = Math.max(0.3, this.adaptiveSettings.performanceWeight - 0.1);
    } else {
      // Normal CPU usage - can afford better compression
      this.adaptiveSettings.performanceWeight = Math.min(0.9, this.adaptiveSettings.performanceWeight + 0.05);
    }
  }

  private getCurrentCpuUsage(): number {
    // Simplified CPU usage estimation
    // In a real implementation, you'd use proper system monitoring
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to percentage approximation
  }

  private serializeData(data: any): Buffer {
    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (typeof data === 'string') {
      return Buffer.from(data, 'utf8');
    }

    // For objects, use JSON serialization
    const jsonString = JSON.stringify(data);
    return Buffer.from(jsonString, 'utf8');
  }

  private deserializeData(buffer: Buffer): any {
    const str = buffer.toString('utf8');
    
    // Try to parse as JSON first
    try {
      return JSON.parse(str);
    } catch {
      // If JSON parsing fails, return as string
      return str;
    }
  }

  private updateCompressionStats(metadata: CompressionResult): void {
    this.stats.totalCompressions++;
    this.stats.totalBytesSaved += (metadata.originalSize - metadata.compressedSize);
    
    // Update overall average compression ratio
    const totalOriginalSize = this.stats.totalBytesSaved + 
      Array.from(this.stats.algorithmStats.values())
        .reduce((sum, stats) => sum + stats.totalCompressedSize, 0);
    const totalCompressedSize = Array.from(this.stats.algorithmStats.values())
      .reduce((sum, stats) => sum + stats.totalCompressedSize, 0);
    
    this.stats.averageCompressionRatio = totalOriginalSize > 0 ? totalOriginalSize / totalCompressedSize : 1.0;

    // Update algorithm-specific stats
    const algorithmStats = this.stats.algorithmStats.get(metadata.algorithm);
    if (algorithmStats) {
      algorithmStats.compressions++;
      algorithmStats.totalOriginalSize += metadata.originalSize;
      algorithmStats.totalCompressedSize += metadata.compressedSize;
      algorithmStats.averageRatio = algorithmStats.totalOriginalSize / algorithmStats.totalCompressedSize;
      algorithmStats.averageCompressionTime = 
        (algorithmStats.averageCompressionTime * (algorithmStats.compressions - 1) + metadata.compressionTime) / 
        algorithmStats.compressions;

      this.stats.algorithmStats.set(metadata.algorithm, algorithmStats);
    }

    // Update recent performance tracking
    const recentPerf = this.recentPerformance.get(metadata.algorithm);
    if (recentPerf) {
      recentPerf.push({
        ratio: metadata.compressionRatio,
        time: metadata.compressionTime,
        timestamp: new Date(),
      });

      // Keep only recent samples
      if (recentPerf.length > this.adaptiveSettings.sampleSize) {
        recentPerf.splice(0, recentPerf.length - this.adaptiveSettings.sampleSize);
      }
    }
  }

  private updateDecompressionStats(algorithm: string, decompressionTime: number): void {
    this.stats.totalDecompressions++;

    const algorithmStats = this.stats.algorithmStats.get(algorithm);
    if (algorithmStats) {
      const prevDecompressions = algorithmStats.compressions; // Use compressions as proxy for decompressions
      algorithmStats.averageDecompressionTime = 
        (algorithmStats.averageDecompressionTime * prevDecompressions + decompressionTime) / 
        (prevDecompressions + 1);

      this.stats.algorithmStats.set(algorithm, algorithmStats);
    }
  }

  // Batch compression for multiple items
  async compressBatch(
    items: Array<{ key: string; data: any }>,
    config: CompressionConfig
  ): Promise<Array<{ key: string; compressedData: Buffer; metadata: CompressionResult }>> {
    const results = [];

    for (const item of items) {
      try {
        const result = await this.compress(item.data, config);
        results.push({
          key: item.key,
          compressedData: result.compressedData,
          metadata: result.metadata,
        });
      } catch (error) {
        console.error(`Failed to compress item ${item.key}:`, error);
        // Add uncompressed item
        const buffer = this.serializeData(item.data);
        results.push({
          key: item.key,
          compressedData: buffer,
          metadata: {
            originalSize: buffer.length,
            compressedSize: buffer.length,
            compressionRatio: 1.0,
            algorithm: 'none',
            compressionTime: 0,
          },
        });
      }
    }

    return results;
  }

  // Dictionary-based compression for similar data
  async createCompressionDictionary(samples: Buffer[]): Promise<Buffer> {
    // This is a simplified dictionary creation
    // In practice, you'd use more sophisticated algorithms like those in Zstandard
    
    const frequencyMap = new Map<string, number>();
    
    for (const sample of samples) {
      // Analyze byte patterns
      for (let i = 0; i < sample.length - 3; i++) {
        const pattern = sample.slice(i, i + 4).toString('hex');
        frequencyMap.set(pattern, (frequencyMap.get(pattern) || 0) + 1);
      }
    }

    // Get most frequent patterns
    const sortedPatterns = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 256); // Top 256 patterns

    // Create dictionary from patterns
    const dictionary = Buffer.concat(
      sortedPatterns.map(([pattern]) => Buffer.from(pattern, 'hex'))
    );

    return dictionary.slice(0, 32768); // Limit dictionary size
  }

  // Performance testing
  async benchmarkAlgorithms(testData: any, iterations = 10): Promise<Map<string, {
    avgCompressionTime: number;
    avgDecompressionTime: number;
    avgCompressionRatio: number;
    reliability: number; // Success rate
  }>> {
    const results = new Map();

    for (const [algorithmName] of this.algorithms) {
      const algorithmResults = {
        avgCompressionTime: 0,
        avgDecompressionTime: 0,
        avgCompressionRatio: 0,
        reliability: 0,
      };

      let successCount = 0;
      const compressionTimes = [];
      const decompressionTimes = [];
      const ratios = [];

      for (let i = 0; i < iterations; i++) {
        try {
          // Compression test
          const compressStart = process.hrtime.bigint();
          const compressResult = await this.compress(testData, {
            algorithm: algorithmName,
            level: 6,
            threshold: 0,
          });
          const compressTime = Number(process.hrtime.bigint() - compressStart) / 1000000;

          // Decompression test
          const decompressStart = process.hrtime.bigint();
          await this.decompress(compressResult.compressedData, algorithmName);
          const decompressTime = Number(process.hrtime.bigint() - decompressStart) / 1000000;

          compressionTimes.push(compressTime);
          decompressionTimes.push(decompressTime);
          ratios.push(compressResult.metadata.compressionRatio);
          successCount++;

        } catch (error) {
          console.warn(`Benchmark failed for ${algorithmName} iteration ${i}:`, error);
        }
      }

      if (successCount > 0) {
        algorithmResults.avgCompressionTime = compressionTimes.reduce((a, b) => a + b, 0) / successCount;
        algorithmResults.avgDecompressionTime = decompressionTimes.reduce((a, b) => a + b, 0) / successCount;
        algorithmResults.avgCompressionRatio = ratios.reduce((a, b) => a + b, 0) / successCount;
        algorithmResults.reliability = successCount / iterations;
      }

      results.set(algorithmName, algorithmResults);
    }

    return results;
  }

  // Public API methods
  getAvailableAlgorithms(): string[] {
    return Array.from(this.algorithms.keys());
  }

  getAlgorithmInfo(name: string): CompressionAlgorithm | null {
    return this.algorithms.get(name) || null;
  }

  getStats(): CompressionStats {
    return { ...this.stats };
  }

  getAdaptiveSettings(): AdaptiveCompressionSettings {
    return { ...this.adaptiveSettings };
  }

  updateAdaptiveSettings(settings: Partial<AdaptiveCompressionSettings>): void {
    this.adaptiveSettings = { ...this.adaptiveSettings, ...settings };
  }

  resetStats(): void {
    this.stats = {
      totalCompressions: 0,
      totalDecompressions: 0,
      totalBytesSaved: 0,
      averageCompressionRatio: 0,
      algorithmStats: new Map(),
    };

    // Reinitialize algorithm stats
    for (const algorithmName of this.algorithms.keys()) {
      this.stats.algorithmStats.set(algorithmName, {
        compressions: 0,
        totalOriginalSize: 0,
        totalCompressedSize: 0,
        averageRatio: 0,
        averageCompressionTime: 0,
        averageDecompressionTime: 0,
      });
    }
  }

  // Estimate compression for size planning
  estimateCompression(dataSize: number, algorithm: string): {
    estimatedCompressedSize: number;
    estimatedTime: number;
    confidence: number;
  } {
    const algorithmInfo = this.algorithms.get(algorithm);
    const algorithmStats = this.stats.algorithmStats.get(algorithm);

    if (!algorithmInfo || !algorithmStats) {
      return {
        estimatedCompressedSize: dataSize,
        estimatedTime: 0,
        confidence: 0,
      };
    }

    // Use historical data if available, otherwise use algorithm defaults
    const ratio = algorithmStats.compressions > 0 ? 
      algorithmStats.averageRatio : 
      algorithmInfo.ratio;
    
    const timePerByte = algorithmStats.compressions > 0 ?
      algorithmStats.averageCompressionTime / (algorithmStats.totalOriginalSize / algorithmStats.compressions) :
      0.001; // Default estimate

    const confidence = Math.min(algorithmStats.compressions / 100, 1.0); // Higher confidence with more samples

    return {
      estimatedCompressedSize: Math.round(dataSize / ratio),
      estimatedTime: Math.round(dataSize * timePerByte),
      confidence,
    };
  }
}
