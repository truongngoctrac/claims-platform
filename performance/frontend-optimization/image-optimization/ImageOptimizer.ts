/**
 * Image Optimization System
 * Comprehensive image optimization for healthcare claims application
 */

export interface ImageOptimizationConfig {
  formats: string[];
  qualities: Record<string, number>;
  sizes: number[];
  lazy: boolean;
  blur: boolean;
  placeholder: 'blur' | 'empty' | 'data-url';
  priority: boolean;
}

export interface OptimizedImageData {
  src: string;
  srcSet: string;
  sizes: string;
  placeholder?: string;
  blurDataURL?: string;
  width: number;
  height: number;
  format: string;
  quality: number;
  loading: 'lazy' | 'eager';
}

export interface ImageStats {
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  format: string;
  dimensions: { width: number; height: number };
  quality: number;
}

export class ImageOptimizer {
  private config: ImageOptimizationConfig;
  private optimizedImages: Map<string, OptimizedImageData> = new Map();

  constructor(config: Partial<ImageOptimizationConfig> = {}) {
    this.config = {
      formats: ['webp', 'avif', 'jpeg', 'png'],
      qualities: {
        jpeg: 85,
        webp: 85,
        avif: 80,
        png: 90
      },
      sizes: [320, 640, 768, 1024, 1280, 1920],
      lazy: true,
      blur: true,
      placeholder: 'blur',
      priority: false,
      ...config
    };
  }

  /**
   * Optimize image and generate responsive variants
   */
  async optimizeImage(
    src: string, 
    options: Partial<ImageOptimizationConfig> = {}
  ): Promise<OptimizedImageData> {
    const finalConfig = { ...this.config, ...options };
    
    // Check cache first
    const cached = this.optimizedImages.get(src);
    if (cached) return cached;

    const imageData = await this.processImage(src, finalConfig);
    this.optimizedImages.set(src, imageData);
    
    return imageData;
  }

  /**
   * Process image with optimization
   */
  private async processImage(
    src: string, 
    config: ImageOptimizationConfig
  ): Promise<OptimizedImageData> {
    const { width, height } = await this.getImageDimensions(src);
    
    // Generate responsive image variants
    const srcSet = this.generateSrcSet(src, config.sizes, config.formats);
    const sizes = this.generateSizes(config.sizes);
    
    // Generate placeholder if needed
    const placeholder = config.blur ? await this.generateBlurPlaceholder(src) : undefined;
    const blurDataURL = config.placeholder === 'blur' ? placeholder : undefined;

    return {
      src: this.optimizeImageUrl(src, { quality: config.qualities.jpeg }),
      srcSet,
      sizes,
      placeholder,
      blurDataURL,
      width,
      height,
      format: this.detectImageFormat(src),
      quality: config.qualities.jpeg,
      loading: config.lazy ? 'lazy' : 'eager'
    };
  }

  /**
   * Generate srcSet for responsive images
   */
  private generateSrcSet(src: string, sizes: number[], formats: string[]): string {
    const variants: string[] = [];
    
    sizes.forEach(size => {
      formats.forEach(format => {
        const optimizedUrl = this.optimizeImageUrl(src, { 
          width: size, 
          format,
          quality: this.config.qualities[format] || 85 
        });
        variants.push(`${optimizedUrl} ${size}w`);
      });
    });
    
    return variants.join(', ');
  }

  /**
   * Generate sizes attribute
   */
  private generateSizes(sizes: number[]): string {
    const mediaQueries = [
      '(max-width: 640px) 100vw',
      '(max-width: 768px) 50vw',
      '(max-width: 1024px) 33vw',
      '25vw'
    ];
    
    return mediaQueries.join(', ');
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        // Fallback dimensions
        resolve({ width: 800, height: 600 });
      };
      img.src = src;
    });
  }

  /**
   * Generate blur placeholder
   */
  private async generateBlurPlaceholder(src: string): Promise<string> {
    // In a real implementation, this would generate a low-quality blur image
    // For now, return a simple data URL
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
  }

  /**
   * Optimize image URL with parameters
   */
  private optimizeImageUrl(
    src: string, 
    params: { width?: number; height?: number; quality?: number; format?: string }
  ): string {
    // In a real implementation, this would integrate with image CDN services
    // like Cloudinary, ImageKit, or custom image processing service
    
    const url = new URL(src, window.location.origin);
    
    if (params.width) url.searchParams.set('w', params.width.toString());
    if (params.height) url.searchParams.set('h', params.height.toString());
    if (params.quality) url.searchParams.set('q', params.quality.toString());
    if (params.format) url.searchParams.set('f', params.format);
    
    return url.toString();
  }

  /**
   * Detect image format from URL
   */
  private detectImageFormat(src: string): string {
    const extension = src.split('.').pop()?.toLowerCase();
    return extension || 'jpeg';
  }

  /**
   * Preload critical images
   */
  preloadCriticalImages(images: string[]): void {
    images.forEach(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
  }

  /**
   * Generate image statistics
   */
  async generateImageStats(src: string): Promise<ImageStats> {
    const { width, height } = await this.getImageDimensions(src);
    
    // Mock size calculations - would normally analyze actual file sizes
    const originalSize = width * height * 3; // Rough estimate for uncompressed
    const optimizedSize = Math.round(originalSize * 0.3); // 70% compression
    
    return {
      originalSize,
      optimizedSize,
      compressionRatio: ((originalSize - optimizedSize) / originalSize) * 100,
      format: this.detectImageFormat(src),
      dimensions: { width, height },
      quality: this.config.qualities.jpeg
    };
  }

  /**
   * Clear optimization cache
   */
  clearCache(): void {
    this.optimizedImages.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; images: string[] } {
    return {
      size: this.optimizedImages.size,
      images: Array.from(this.optimizedImages.keys())
    };
  }
}

/**
 * Smart Image Component Props
 */
export interface SmartImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  quality?: number;
  sizes?: string;
  className?: string;
  placeholder?: 'blur' | 'empty';
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Image Performance Monitor
 */
export class ImagePerformanceMonitor {
  private loadTimes: Map<string, number> = new Map();
  private observer: IntersectionObserver | null = null;

  constructor() {
    this.setupIntersectionObserver();
  }

  /**
   * Setup intersection observer for lazy loading monitoring
   */
  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              this.startLoadTimer(img.src);
            }
          });
        },
        { threshold: 0.1 }
      );
    }
  }

  /**
   * Monitor image loading performance
   */
  monitorImage(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.observe(img);
    }

    img.addEventListener('load', () => {
      this.recordLoadTime(img.src);
    });

    img.addEventListener('error', () => {
      console.warn(`Failed to load image: ${img.src}`);
    });
  }

  /**
   * Start load timer for image
   */
  private startLoadTimer(src: string): void {
    this.loadTimes.set(src, performance.now());
  }

  /**
   * Record load time when image loads
   */
  private recordLoadTime(src: string): void {
    const startTime = this.loadTimes.get(src);
    if (startTime) {
      const loadTime = performance.now() - startTime;
      console.log(`Image loaded in ${loadTime.toFixed(2)}ms: ${src}`);
      
      // Track in analytics
      this.trackImagePerformance(src, loadTime);
    }
  }

  /**
   * Track image performance in analytics
   */
  private trackImagePerformance(src: string, loadTime: number): void {
    // In real implementation, send to analytics service
    if (loadTime > 2000) { // 2 seconds
      console.warn(`Slow image load detected: ${src} (${loadTime.toFixed(2)}ms)`);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): { averageLoadTime: number; slowImages: string[] } {
    const loadTimes = Array.from(this.loadTimes.values());
    const averageLoadTime = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
    
    const slowImages = Array.from(this.loadTimes.entries())
      .filter(([, time]) => time > 2000)
      .map(([src]) => src);

    return { averageLoadTime, slowImages };
  }

  /**
   * Cleanup observer
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

/**
 * Image optimization utilities
 */
export class ImageOptimizationUtils {
  /**
   * Check if image format is supported
   */
  static checkFormatSupport(): Record<string, boolean> {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    return {
      webp: canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0,
      avif: canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0,
      jpeg: true,
      png: true
    };
  }

  /**
   * Get optimal image format for browser
   */
  static getOptimalFormat(): string {
    const support = this.checkFormatSupport();
    
    if (support.avif) return 'avif';
    if (support.webp) return 'webp';
    return 'jpeg';
  }

  /**
   * Calculate aspect ratio
   */
  static calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  /**
   * Generate responsive breakpoints
   */
  static generateBreakpoints(maxWidth: number): number[] {
    const breakpoints = [];
    let width = 320;
    
    while (width <= maxWidth) {
      breakpoints.push(width);
      width = Math.round(width * 1.5);
    }
    
    if (breakpoints[breakpoints.length - 1] !== maxWidth) {
      breakpoints.push(maxWidth);
    }
    
    return breakpoints;
  }

  /**
   * Estimate file size for image
   */
  static estimateFileSize(
    width: number, 
    height: number, 
    format: string, 
    quality: number
  ): number {
    const pixels = width * height;
    
    const compressionRatios: Record<string, number> = {
      jpeg: 0.1 * (quality / 100),
      webp: 0.08 * (quality / 100),
      avif: 0.06 * (quality / 100),
      png: 0.3
    };
    
    const ratio = compressionRatios[format] || 0.1;
    return Math.round(pixels * 3 * ratio); // 3 bytes per pixel for RGB
  }
}
