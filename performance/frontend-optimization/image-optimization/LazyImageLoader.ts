/**
 * Advanced Lazy Image Loading System
 * Implements progressive loading strategies for optimal performance
 */

export interface LazyLoadConfig {
  rootMargin: string;
  threshold: number;
  enableNativeLazy: boolean;
  fallbackDelay: number;
  preloadDistance: number;
  priorityImages: string[];
}

export interface ImageLoadState {
  status: 'pending' | 'loading' | 'loaded' | 'error';
  progress?: number;
  size?: number;
  loadTime?: number;
}

export class LazyImageLoader {
  private observer: IntersectionObserver | null = null;
  private config: LazyLoadConfig;
  private imageStates: Map<string, ImageLoadState> = new Map();
  private preloadQueue: string[] = [];
  private isNativeLazySupported: boolean;

  constructor(config: Partial<LazyLoadConfig> = {}) {
    this.config = {
      rootMargin: '50px',
      threshold: 0.1,
      enableNativeLazy: true,
      fallbackDelay: 300,
      preloadDistance: 200,
      priorityImages: [],
      ...config
    };

    this.isNativeLazySupported = 'loading' in HTMLImageElement.prototype;
    this.initializeObserver();
  }

  /**
   * Initialize intersection observer
   */
  private initializeObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      console.warn('IntersectionObserver not supported, falling back to immediate loading');
      return;
    }

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: this.config.rootMargin,
        threshold: this.config.threshold
      }
    );
  }

  /**
   * Handle intersection observer events
   */
  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        this.loadImage(img);
        this.observer?.unobserve(img);
      }
    });
  }

  /**
   * Register image for lazy loading
   */
  observeImage(img: HTMLImageElement): void {
    const src = img.dataset.src || img.src;
    
    // Initialize state
    this.imageStates.set(src, { status: 'pending' });

    // Check if it's a priority image
    if (this.config.priorityImages.includes(src)) {
      this.loadImage(img);
      return;
    }

    // Use native lazy loading if supported and enabled
    if (this.isNativeLazySupported && this.config.enableNativeLazy) {
      img.loading = 'lazy';
      this.setupImageLoadHandlers(img);
      return;
    }

    // Use intersection observer fallback
    if (this.observer) {
      this.observer.observe(img);
    } else {
      // Fallback: load after delay
      setTimeout(() => this.loadImage(img), this.config.fallbackDelay);
    }
  }

  /**
   * Load image with progress tracking
   */
  private async loadImage(img: HTMLImageElement): Promise<void> {
    const src = img.dataset.src || img.src;
    const state = this.imageStates.get(src);
    
    if (!state || state.status !== 'pending') return;

    // Update state to loading
    this.imageStates.set(src, { ...state, status: 'loading' });
    
    const startTime = performance.now();

    try {
      // Create new image for preloading
      const preloadImg = new Image();
      
      // Setup progress tracking if possible
      this.setupProgressTracking(preloadImg, src);
      
      // Setup load handlers
      await new Promise<void>((resolve, reject) => {
        preloadImg.onload = () => {
          const loadTime = performance.now() - startTime;
          
          // Update original image
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          
          // Update state
          this.imageStates.set(src, {
            status: 'loaded',
            loadTime,
            size: this.estimateImageSize(preloadImg)
          });
          
          // Add loaded class for animations
          img.classList.add('lazy-loaded');
          
          resolve();
        };
        
        preloadImg.onerror = () => {
          this.imageStates.set(src, { status: 'error' });
          img.classList.add('lazy-error');
          reject(new Error(`Failed to load image: ${src}`));
        };
        
        preloadImg.src = src;
      });
      
    } catch (error) {
      console.error('Error loading image:', error);
    }
  }

  /**
   * Setup progress tracking for image loading
   */
  private setupProgressTracking(img: HTMLImageElement, src: string): void {
    // Note: Progress tracking for images is limited in browsers
    // This is a simplified implementation
    let progressInterval: NodeJS.Timeout;
    let progress = 0;
    
    const updateProgress = () => {
      progress = Math.min(progress + 10, 90);
      const state = this.imageStates.get(src);
      if (state) {
        this.imageStates.set(src, { ...state, progress });
      }
    };
    
    progressInterval = setInterval(updateProgress, 100);
    
    img.addEventListener('load', () => {
      clearInterval(progressInterval);
      const state = this.imageStates.get(src);
      if (state) {
        this.imageStates.set(src, { ...state, progress: 100 });
      }
    });
  }

  /**
   * Setup image load handlers
   */
  private setupImageLoadHandlers(img: HTMLImageElement): void {
    const src = img.dataset.src || img.src;
    
    img.addEventListener('load', () => {
      const state = this.imageStates.get(src);
      if (state) {
        this.imageStates.set(src, { 
          ...state, 
          status: 'loaded',
          size: this.estimateImageSize(img)
        });
      }
      img.classList.add('lazy-loaded');
    });

    img.addEventListener('error', () => {
      this.imageStates.set(src, { status: 'error' });
      img.classList.add('lazy-error');
    });
  }

  /**
   * Estimate image size
   */
  private estimateImageSize(img: HTMLImageElement): number {
    // Rough estimation based on dimensions and assumed compression
    return img.naturalWidth * img.naturalHeight * 0.3; // ~30% of uncompressed size
  }

  /**
   * Preload images in background
   */
  preloadImages(urls: string[]): Promise<void[]> {
    return Promise.all(
      urls.map(url => this.preloadSingleImage(url))
    );
  }

  /**
   * Preload single image
   */
  private preloadSingleImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
      img.src = url;
    });
  }

  /**
   * Get loading statistics
   */
  getLoadingStats(): {
    total: number;
    loaded: number;
    loading: number;
    pending: number;
    errors: number;
    averageLoadTime: number;
  } {
    const states = Array.from(this.imageStates.values());
    const total = states.length;
    const loaded = states.filter(s => s.status === 'loaded').length;
    const loading = states.filter(s => s.status === 'loading').length;
    const pending = states.filter(s => s.status === 'pending').length;
    const errors = states.filter(s => s.status === 'error').length;
    
    const loadTimes = states
      .filter(s => s.loadTime)
      .map(s => s.loadTime!);
    const averageLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length
      : 0;

    return {
      total,
      loaded,
      loading,
      pending,
      errors,
      averageLoadTime
    };
  }

  /**
   * Get image state
   */
  getImageState(src: string): ImageLoadState | undefined {
    return this.imageStates.get(src);
  }

  /**
   * Force load all pending images
   */
  loadAllPending(): void {
    this.imageStates.forEach((state, src) => {
      if (state.status === 'pending') {
        const img = document.querySelector(`img[data-src="${src}"]`) as HTMLImageElement;
        if (img) {
          this.loadImage(img);
        }
      }
    });
  }

  /**
   * Cleanup observers and clear states
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.imageStates.clear();
    this.preloadQueue = [];
  }
}

/**
 * Progressive Image Loading System
 */
export class ProgressiveImageLoader {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Create progressive loading effect
   */
  async createProgressiveLoad(
    img: HTMLImageElement,
    quality: number = 0.1
  ): Promise<string> {
    // Set canvas size to match image
    this.canvas.width = img.naturalWidth;
    this.canvas.height = img.naturalHeight;

    // Draw image at low quality
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'low';
    
    // Create pixelated version
    const smallWidth = Math.max(1, Math.floor(img.naturalWidth * quality));
    const smallHeight = Math.max(1, Math.floor(img.naturalHeight * quality));
    
    // Draw small version
    this.ctx.drawImage(img, 0, 0, smallWidth, smallHeight);
    
    // Scale back up
    this.ctx.drawImage(
      this.canvas, 
      0, 0, smallWidth, smallHeight,
      0, 0, img.naturalWidth, img.naturalHeight
    );

    // Apply blur effect
    this.ctx.filter = 'blur(2px)';
    this.ctx.drawImage(this.canvas, 0, 0);

    return this.canvas.toDataURL('image/jpeg', 0.7);
  }

  /**
   * Generate blur placeholder
   */
  generateBlurPlaceholder(img: HTMLImageElement): string {
    const size = 40; // Small size for blur effect
    this.canvas.width = size;
    this.canvas.height = size;

    this.ctx.drawImage(img, 0, 0, size, size);
    this.ctx.filter = 'blur(4px)';
    this.ctx.drawImage(this.canvas, 0, 0);

    return this.canvas.toDataURL('image/jpeg', 0.6);
  }

  /**
   * Create dominant color placeholder
   */
  getDominantColor(img: HTMLImageElement): string {
    this.canvas.width = 1;
    this.canvas.height = 1;
    
    this.ctx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = this.ctx.getImageData(0, 0, 1, 1).data;
    
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Image Loading Performance Monitor
 */
export class ImageLoadingMonitor {
  private loadEvents: Array<{
    src: string;
    loadTime: number;
    size: number;
    timestamp: number;
  }> = [];

  /**
   * Record image load event
   */
  recordLoad(src: string, loadTime: number, size: number): void {
    this.loadEvents.push({
      src,
      loadTime,
      size,
      timestamp: Date.now()
    });

    // Keep only last 100 events
    if (this.loadEvents.length > 100) {
      this.loadEvents.shift();
    }

    // Log slow loads
    if (loadTime > 2000) {
      console.warn(`Slow image load: ${src} (${loadTime}ms)`);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    averageLoadTime: number;
    slowLoads: number;
    totalDataTransfer: number;
    imagesPerSecond: number;
  } {
    if (this.loadEvents.length === 0) {
      return {
        averageLoadTime: 0,
        slowLoads: 0,
        totalDataTransfer: 0,
        imagesPerSecond: 0
      };
    }

    const loadTimes = this.loadEvents.map(e => e.loadTime);
    const averageLoadTime = loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length;
    const slowLoads = loadTimes.filter(time => time > 2000).length;
    const totalDataTransfer = this.loadEvents.reduce((sum, e) => sum + e.size, 0);
    
    // Calculate images per second over last minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentEvents = this.loadEvents.filter(e => e.timestamp > oneMinuteAgo);
    const imagesPerSecond = recentEvents.length / 60;

    return {
      averageLoadTime,
      slowLoads,
      totalDataTransfer,
      imagesPerSecond
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    
    return `
# Image Loading Performance Report

- **Average Load Time**: ${metrics.averageLoadTime.toFixed(2)}ms
- **Slow Loads (>2s)**: ${metrics.slowLoads}
- **Total Data Transfer**: ${(metrics.totalDataTransfer / 1024 / 1024).toFixed(2)}MB
- **Images/Second**: ${metrics.imagesPerSecond.toFixed(2)}

## Recommendations
${metrics.averageLoadTime > 1000 ? '⚠️ Consider optimizing image sizes' : '✅ Load times are good'}
${metrics.slowLoads > 0 ? '⚠️ Some images are loading slowly' : '✅ No slow loading images'}
${metrics.totalDataTransfer > 10 * 1024 * 1024 ? '⚠️ High data usage detected' : '✅ Data usage is reasonable'}
    `.trim();
  }
}
