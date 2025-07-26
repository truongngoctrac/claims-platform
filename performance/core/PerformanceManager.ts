/**
 * Core Performance Manager
 * Central coordinator for all performance optimization features
 */

import { PerformanceOptimizationConfig, PerformanceMetrics, MemoryLeakReport } from '../types';
import { WebVitalsMonitor } from '../frontend-optimization/web-vitals/WebVitalsMonitor';
import { MemoryLeakDetector } from '../frontend-optimization/memory-leak-detection/MemoryLeakDetector';
import { CacheManager } from '../frontend-optimization/caching/CacheManager';
import { PerformanceProfiler } from '../frontend-optimization/runtime-profiling/PerformanceProfiler';

export class PerformanceManager {
  private static instance: PerformanceManager;
  private config: PerformanceOptimizationConfig;
  private webVitalsMonitor: WebVitalsMonitor;
  private memoryLeakDetector: MemoryLeakDetector;
  private cacheManager: CacheManager;
  private performanceProfiler: PerformanceProfiler;
  private metrics: PerformanceMetrics = {
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0,
    tti: 0
  };

  private constructor(config: PerformanceOptimizationConfig) {
    this.config = config;
    this.webVitalsMonitor = new WebVitalsMonitor(config.monitoring);
    this.memoryLeakDetector = new MemoryLeakDetector();
    this.cacheManager = new CacheManager(config.caching);
    this.performanceProfiler = new PerformanceProfiler();
    this.initialize();
  }

  public static getInstance(config?: PerformanceOptimizationConfig): PerformanceManager {
    if (!PerformanceManager.instance && config) {
      PerformanceManager.instance = new PerformanceManager(config);
    }
    return PerformanceManager.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize all performance optimization components
      await this.webVitalsMonitor.initialize();
      this.memoryLeakDetector.startMonitoring();
      this.cacheManager.initialize();
      this.performanceProfiler.startProfiling();

      // Set up performance observers
      this.setupPerformanceObservers();
      
      console.log('🚀 Performance optimization suite initialized');
    } catch (error) {
      console.error('Failed to initialize performance manager:', error);
    }
  }

  private setupPerformanceObservers(): void {
    // Long Task Observer
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.warn(`Long task detected: ${entry.duration}ms`);
          this.reportPerformanceIssue('long-task', {
            duration: entry.duration,
            startTime: entry.startTime
          });
        });
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('Long task observer not supported');
      }

      // Resource timing observer
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 1000) { // Resources taking more than 1 second
            console.warn(`Slow resource: ${entry.name} - ${entry.duration}ms`);
          }
        });
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('Resource observer not supported');
      }
    }
  }

  public updateMetrics(newMetrics: Partial<PerformanceMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics };
    this.checkThresholds();
  }

  private checkThresholds(): void {
    const { thresholds } = this.config;
    
    Object.entries(this.metrics).forEach(([metric, value]) => {
      const threshold = thresholds[metric as keyof PerformanceMetrics];
      if (value > threshold) {
        this.reportPerformanceIssue('threshold-exceeded', {
          metric,
          value,
          threshold
        });
      }
    });
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public async getMemoryReport(): Promise<MemoryLeakReport> {
    return this.memoryLeakDetector.generateReport();
  }

  public optimizeBundle(): void {
    // Trigger bundle optimization
    console.log('🔧 Optimizing bundle...');
    // Implementation would trigger build-time optimizations
  }

  public preloadCriticalResources(): void {
    const { criticalAssets } = this.config.resourcePreload;
    
    criticalAssets.forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = asset;
      
      if (asset.endsWith('.js')) {
        link.as = 'script';
      } else if (asset.endsWith('.css')) {
        link.as = 'style';
      } else if (asset.match(/\.(woff|woff2|ttf|otf)$/)) {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      } else if (asset.match(/\.(jpg|jpeg|png|webp|avif)$/)) {
        link.as = 'image';
      }
      
      document.head.appendChild(link);
    });
  }

  public enableServiceWorker(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }

  private reportPerformanceIssue(type: string, data: any): void {
    if (this.config.monitoring.enabled) {
      // Send to monitoring service
      fetch(this.config.monitoring.reportingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(console.error);
    }
  }

  public generatePerformanceReport(): any {
    return {
      metrics: this.metrics,
      memoryUsage: this.memoryLeakDetector.getCurrentMemoryUsage(),
      cacheStats: this.cacheManager.getStats(),
      profilerData: this.performanceProfiler.getReport(),
      timestamp: Date.now()
    };
  }

  public cleanup(): void {
    this.memoryLeakDetector.stopMonitoring();
    this.performanceProfiler.stopProfiling();
    this.cacheManager.cleanup();
  }
}
