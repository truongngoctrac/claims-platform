import { createGzip, createDeflate, createBrotliCompress } from 'zlib';
import { Request, Response, NextFunction } from 'express';
import { Transform } from 'stream';

export interface CompressionConfig {
  threshold: number; // Minimum response size to compress (bytes)
  level: number; // Compression level (1-9)
  algorithms: CompressionAlgorithm[];
  chunkSize: number;
  windowBits: number;
  memLevel: number;
  strategy: 'filtered' | 'huffmanOnly' | 'rle' | 'fixed' | 'defaultStrategy';
  enableETags: boolean;
  enableVary: boolean;
}

export type CompressionAlgorithm = 'gzip' | 'deflate' | 'br' | 'identity';

export interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  compressionRatio: number;
  averageCompressionTime: number;
  algorithmUsage: Record<CompressionAlgorithm, number>;
}

export class ResponseCompressionManager {
  private config: CompressionConfig;
  private stats: CompressionStats;

  constructor(config: CompressionConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      averageCompressionTime: 0,
      algorithmUsage: {
        gzip: 0,
        deflate: 0,
        br: 0,
        identity: 0
      }
    };
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      this.stats.totalRequests++;

      // Skip compression for certain content types
      if (this.shouldSkipCompression(req, res)) {
        return next();
      }

      // Determine best compression algorithm
      const algorithm = this.negotiateCompression(req);
      
      if (algorithm === 'identity') {
        this.stats.algorithmUsage.identity++;
        return next();
      }

      // Set up compression
      this.setupCompression(req, res, algorithm);
      
      next();
    };
  }

  private shouldSkipCompression(req: Request, res: Response): boolean {
    // Skip if already compressed
    if (res.get('Content-Encoding')) {
      return true;
    }

    // Skip for small responses (will be checked later)
    const contentLength = parseInt(res.get('Content-Length') || '0');
    if (contentLength > 0 && contentLength < this.config.threshold) {
      return true;
    }

    // Skip for certain content types
    const contentType = res.get('Content-Type') || '';
    const skipTypes = [
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/x-compressed'
    ];

    return skipTypes.some(type => contentType.includes(type));
  }

  private negotiateCompression(req: Request): CompressionAlgorithm {
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const clientSupports = this.parseAcceptEncoding(acceptEncoding);

    // Find the best algorithm based on client support and our preferences
    for (const algorithm of this.config.algorithms) {
      if (clientSupports.has(algorithm)) {
        return algorithm;
      }
    }

    return 'identity';
  }

  private parseAcceptEncoding(acceptEncoding: string): Set<CompressionAlgorithm> {
    const algorithms = new Set<CompressionAlgorithm>();
    
    // Parse Accept-Encoding header
    const encodings = acceptEncoding.toLowerCase().split(',');
    
    for (const encoding of encodings) {
      const trimmed = encoding.trim().split(';')[0];
      
      switch (trimmed) {
        case 'gzip':
          algorithms.add('gzip');
          break;
        case 'deflate':
          algorithms.add('deflate');
          break;
        case 'br':
          algorithms.add('br');
          break;
        case '*':
          algorithms.add('gzip'); // Default to gzip for wildcard
          break;
      }
    }

    return algorithms;
  }

  private setupCompression(req: Request, res: Response, algorithm: CompressionAlgorithm): void {
    const startTime = Date.now();
    let originalSize = 0;
    let compressedSize = 0;

    // Create compression stream
    const compressionStream = this.createCompressionStream(algorithm);
    
    if (!compressionStream) {
      this.stats.algorithmUsage.identity++;
      return;
    }

    // Track compression performance
    compressionStream.on('data', (chunk) => {
      compressedSize += chunk.length;
    });

    compressionStream.on('end', () => {
      const compressionTime = Date.now() - startTime;
      this.updateCompressionStats(algorithm, originalSize, compressedSize, compressionTime);
    });

    // Override response methods
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    
    let headersSent = false;

    const sendHeaders = () => {
      if (!headersSent) {
        res.set('Content-Encoding', algorithm);
        
        if (this.config.enableVary) {
          const vary = res.get('Vary') || '';
          const varyValues = vary ? vary.split(',').map(v => v.trim()) : [];
          if (!varyValues.includes('Accept-Encoding')) {
            varyValues.push('Accept-Encoding');
            res.set('Vary', varyValues.join(', '));
          }
        }

        // Remove Content-Length header as it will change
        res.removeHeader('Content-Length');
        
        if (this.config.enableETags) {
          this.generateCompressedETag(res, algorithm);
        }

        headersSent = true;
      }
    };

    res.write = function(chunk: any, encoding?: any): boolean {
      if (typeof chunk === 'string') {
        originalSize += Buffer.byteLength(chunk, encoding);
      } else if (Buffer.isBuffer(chunk)) {
        originalSize += chunk.length;
      }

      // Check size threshold
      if (originalSize >= this.config.threshold) {
        sendHeaders();
        return compressionStream.write(chunk, encoding);
      } else {
        // If below threshold, write directly without compression
        return originalWrite(chunk, encoding);
      }
    }.bind(this);

    res.end = function(chunk?: any, encoding?: any): Response {
      if (chunk) {
        if (typeof chunk === 'string') {
          originalSize += Buffer.byteLength(chunk, encoding);
        } else if (Buffer.isBuffer(chunk)) {
          originalSize += chunk.length;
        }
      }

      if (originalSize >= this.config.threshold && !headersSent) {
        sendHeaders();
        compressionStream.end(chunk, encoding);
        compressionStream.pipe(res, { end: true });
      } else {
        // Response too small, send uncompressed
        this.stats.algorithmUsage.identity++;
        originalEnd(chunk, encoding);
      }

      return res;
    }.bind(this);
  }

  private createCompressionStream(algorithm: CompressionAlgorithm): Transform | null {
    const options = {
      level: this.config.level,
      chunkSize: this.config.chunkSize,
      windowBits: this.config.windowBits,
      memLevel: this.config.memLevel,
      strategy: this.getZlibStrategy()
    };

    switch (algorithm) {
      case 'gzip':
        return createGzip(options);
      case 'deflate':
        return createDeflate(options);
      case 'br':
        return createBrotliCompress({
          params: {
            [require('zlib').constants.BROTLI_PARAM_QUALITY]: this.config.level,
            [require('zlib').constants.BROTLI_PARAM_SIZE_HINT]: this.config.chunkSize
          }
        });
      default:
        return null;
    }
  }

  private getZlibStrategy(): number {
    const zlib = require('zlib');
    
    switch (this.config.strategy) {
      case 'filtered': return zlib.constants.Z_FILTERED;
      case 'huffmanOnly': return zlib.constants.Z_HUFFMAN_ONLY;
      case 'rle': return zlib.constants.Z_RLE;
      case 'fixed': return zlib.constants.Z_FIXED;
      default: return zlib.constants.Z_DEFAULT_STRATEGY;
    }
  }

  private generateCompressedETag(res: Response, algorithm: CompressionAlgorithm): void {
    const etag = res.get('ETag');
    if (etag) {
      // Modify ETag to include compression algorithm
      const compressedETag = etag.replace(/"$/, `-${algorithm}"`);
      res.set('ETag', compressedETag);
    }
  }

  private updateCompressionStats(
    algorithm: CompressionAlgorithm,
    originalSize: number,
    compressedSize: number,
    compressionTime: number
  ): void {
    this.stats.compressedRequests++;
    this.stats.algorithmUsage[algorithm]++;
    this.stats.totalOriginalSize += originalSize;
    this.stats.totalCompressedSize += compressedSize;

    // Update compression ratio
    if (this.stats.totalOriginalSize > 0) {
      this.stats.compressionRatio = 
        (1 - this.stats.totalCompressedSize / this.stats.totalOriginalSize) * 100;
    }

    // Update average compression time
    this.stats.averageCompressionTime = 
      (this.stats.averageCompressionTime * (this.stats.compressedRequests - 1) + compressionTime) /
      this.stats.compressedRequests;
  }

  getCompressionStats(): CompressionStats {
    return { ...this.stats };
  }

  getCompressionRatio(): number {
    return this.stats.compressionRatio;
  }

  getBestAlgorithmForContent(contentType: string, size: number): CompressionAlgorithm {
    // Recommendations based on content type and size
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      if (size > 1024 * 1024) { // 1MB+
        return 'br'; // Best compression for large text
      } else if (size > 10 * 1024) { // 10KB+
        return 'gzip'; // Good balance
      }
    }

    if (contentType.includes('text/html')) {
      return 'br'; // Excellent for HTML
    }

    if (contentType.includes('application/javascript') || contentType.includes('text/css')) {
      return 'gzip'; // Good for JS/CSS
    }

    return 'gzip'; // Default
  }

  compressBatch(items: Array<{content: string, contentType: string}>): Promise<Array<{
    original: string;
    compressed: Buffer;
    algorithm: CompressionAlgorithm;
    compressionRatio: number;
  }>> {
    return Promise.all(
      items.map(async (item) => {
        const algorithm = this.getBestAlgorithmForContent(item.contentType, item.content.length);
        const compressed = await this.compressContent(item.content, algorithm);
        
        return {
          original: item.content,
          compressed,
          algorithm,
          compressionRatio: (1 - compressed.length / Buffer.byteLength(item.content)) * 100
        };
      })
    );
  }

  private compressContent(content: string, algorithm: CompressionAlgorithm): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const stream = this.createCompressionStream(algorithm);
      
      if (!stream) {
        resolve(Buffer.from(content));
        return;
      }

      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
      
      stream.end(content);
    });
  }

  optimizeCompressionLevel(sampleContent: string[]): Promise<{
    algorithm: CompressionAlgorithm;
    level: number;
    avgCompressionRatio: number;
    avgCompressionTime: number;
  }> {
    return new Promise(async (resolve) => {
      const results: Array<{
        algorithm: CompressionAlgorithm;
        level: number;
        ratio: number;
        time: number;
      }> = [];

      for (const algorithm of this.config.algorithms) {
        if (algorithm === 'identity') continue;

        for (let level = 1; level <= 9; level++) {
          const startTime = Date.now();
          let totalRatio = 0;

          for (const content of sampleContent) {
            const originalConfig = this.config.level;
            this.config.level = level;
            
            const compressed = await this.compressContent(content, algorithm);
            const ratio = (1 - compressed.length / Buffer.byteLength(content)) * 100;
            totalRatio += ratio;
            
            this.config.level = originalConfig;
          }

          const avgRatio = totalRatio / sampleContent.length;
          const time = Date.now() - startTime;

          results.push({
            algorithm,
            level,
            ratio: avgRatio,
            time
          });
        }
      }

      // Find best balance of compression ratio and time
      const best = results.reduce((best, current) => {
        const bestScore = best.ratio / Math.log(best.time + 1);
        const currentScore = current.ratio / Math.log(current.time + 1);
        return currentScore > bestScore ? current : best;
      });

      resolve({
        algorithm: best.algorithm,
        level: best.level,
        avgCompressionRatio: best.ratio,
        avgCompressionTime: best.time
      });
    });
  }

  generateCompressionReport(): {
    totalSavings: number;
    compressionEfficiency: number;
    recommendedSettings: {
      algorithm: CompressionAlgorithm;
      level: number;
    };
    performanceMetrics: {
      averageCompressionTime: number;
      compressionRatio: number;
      bandwidthSaved: number;
    };
  } {
    const totalSavings = this.stats.totalOriginalSize - this.stats.totalCompressedSize;
    const compressionEfficiency = this.stats.compressedRequests / this.stats.totalRequests * 100;
    
    // Find most used algorithm
    const mostUsedAlgorithm = Object.entries(this.stats.algorithmUsage)
      .reduce((a, b) => a[1] > b[1] ? a : b)[0] as CompressionAlgorithm;

    return {
      totalSavings,
      compressionEfficiency,
      recommendedSettings: {
        algorithm: mostUsedAlgorithm,
        level: this.config.level
      },
      performanceMetrics: {
        averageCompressionTime: this.stats.averageCompressionTime,
        compressionRatio: this.stats.compressionRatio,
        bandwidthSaved: totalSavings
      }
    };
  }

  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      compressedRequests: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      averageCompressionTime: 0,
      algorithmUsage: {
        gzip: 0,
        deflate: 0,
        br: 0,
        identity: 0
      }
    };
  }
}

// Predefined compression configurations
export const CompressionPresets = {
  maximum: {
    threshold: 1024, // 1KB
    level: 9,
    algorithms: ['br', 'gzip', 'deflate'] as CompressionAlgorithm[],
    chunkSize: 16 * 1024,
    windowBits: 15,
    memLevel: 8,
    strategy: 'defaultStrategy' as const,
    enableETags: true,
    enableVary: true
  },

  balanced: {
    threshold: 1024, // 1KB
    level: 6,
    algorithms: ['gzip', 'br', 'deflate'] as CompressionAlgorithm[],
    chunkSize: 16 * 1024,
    windowBits: 15,
    memLevel: 8,
    strategy: 'defaultStrategy' as const,
    enableETags: true,
    enableVary: true
  },

  fast: {
    threshold: 2048, // 2KB
    level: 1,
    algorithms: ['gzip', 'deflate'] as CompressionAlgorithm[],
    chunkSize: 8 * 1024,
    windowBits: 15,
    memLevel: 8,
    strategy: 'defaultStrategy' as const,
    enableETags: false,
    enableVary: true
  },

  minimal: {
    threshold: 4096, // 4KB
    level: 3,
    algorithms: ['gzip'] as CompressionAlgorithm[],
    chunkSize: 8 * 1024,
    windowBits: 15,
    memLevel: 8,
    strategy: 'defaultStrategy' as const,
    enableETags: false,
    enableVary: false
  }
};
