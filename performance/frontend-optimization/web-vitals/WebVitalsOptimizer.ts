/**
 * Web Vitals Optimization System
 * Comprehensive Core Web Vitals monitoring and optimization
 */

export interface WebVitalsConfig {
  thresholds: {
    lcp: { good: number; needsImprovement: number };
    fid: { good: number; needsImprovement: number };
    cls: { good: number; needsImprovement: number };
    fcp: { good: number; needsImprovement: number };
    ttfb: { good: number; needsImprovement: number };
  };
  reportingEndpoint?: string;
  enableRealTimeMonitoring: boolean;
  enableOptimizations: boolean;
}

export interface VitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  id: string;
  entries: PerformanceEntry[];
}

export interface WebVitalsReport {
  metrics: Record<string, VitalMetric>;
  optimizations: Optimization[];
  recommendations: Recommendation[];
  performance: {
    score: number;
    grade: string;
  };
}

export interface Optimization {
  type: 'lcp' | 'fid' | 'cls' | 'fcp' | 'ttfb';
  description: string;
  impact: 'high' | 'medium' | 'low';
  implementation: string;
  estimatedImprovement: number;
}

export interface Recommendation {
  metric: string;
  issue: string;
  solution: string;
  priority: 'high' | 'medium' | 'low';
  codeExample?: string;
}

export class WebVitalsOptimizer {
  private config: WebVitalsConfig;
  private metrics: Map<string, VitalMetric> = new Map();
  private observer?: PerformanceObserver;
  private lcpObserver?: PerformanceObserver;
  private clsObserver?: PerformanceObserver;

  constructor(config: Partial<WebVitalsConfig> = {}) {
    this.config = {
      thresholds: {
        lcp: { good: 2500, needsImprovement: 4000 },
        fid: { good: 100, needsImprovement: 300 },
        cls: { good: 0.1, needsImprovement: 0.25 },
        fcp: { good: 1800, needsImprovement: 3000 },
        ttfb: { good: 800, needsImprovement: 1800 }
      },
      enableRealTimeMonitoring: true,
      enableOptimizations: true,
      ...config
    };

    this.initializeMonitoring();
    if (this.config.enableOptimizations) {
      this.initializeOptimizations();
    }
  }

  /**
   * Initialize Web Vitals monitoring
   */
  private initializeMonitoring(): void {
    if (!this.config.enableRealTimeMonitoring) return;

    // Monitor LCP (Largest Contentful Paint)
    this.monitorLCP();
    
    // Monitor FID (First Input Delay)
    this.monitorFID();
    
    // Monitor CLS (Cumulative Layout Shift)
    this.monitorCLS();
    
    // Monitor FCP (First Contentful Paint)
    this.monitorFCP();
    
    // Monitor TTFB (Time to First Byte)
    this.monitorTTFB();
  }

  /**
   * Monitor Largest Contentful Paint
   */
  private monitorLCP(): void {
    try {
      this.lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        
        if (lastEntry) {
          this.recordMetric('LCP', lastEntry.startTime, entries);
        }
      });
      
      this.lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('LCP monitoring not supported:', error);
    }
  }

  /**
   * Monitor First Input Delay
   */
  private monitorFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            const fid = entry.processingStart - entry.startTime;
            this.recordMetric('FID', fid, [entry]);
          }
        });
      });
      
      observer.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      console.warn('FID monitoring not supported:', error);
    }
  }

  /**
   * Monitor Cumulative Layout Shift
   */
  private monitorCLS(): void {
    try {
      let clsValue = 0;
      const clsEntries: PerformanceEntry[] = [];

      this.clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            clsEntries.push(entry);
          }
        });
        
        this.recordMetric('CLS', clsValue, clsEntries);
      });
      
      this.clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('CLS monitoring not supported:', error);
    }
  }

  /**
   * Monitor First Contentful Paint
   */
  private monitorFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        
        if (fcpEntry) {
          this.recordMetric('FCP', fcpEntry.startTime, [fcpEntry]);
        }
      });
      
      observer.observe({ entryTypes: ['paint'] });
    } catch (error) {
      console.warn('FCP monitoring not supported:', error);
    }
  }

  /**
   * Monitor Time to First Byte
   */
  private monitorTTFB(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.responseStart && entry.requestStart) {
            const ttfb = entry.responseStart - entry.requestStart;
            this.recordMetric('TTFB', ttfb, [entry]);
          }
        });
      });
      
      observer.observe({ entryTypes: ['navigation'] });
    } catch (error) {
      console.warn('TTFB monitoring not supported:', error);
    }
  }

  /**
   * Record metric value
   */
  private recordMetric(name: string, value: number, entries: PerformanceEntry[]): void {
    const metric: VitalMetric = {
      name,
      value,
      rating: this.calculateRating(name, value),
      timestamp: Date.now(),
      id: `${name}-${Date.now()}`,
      entries
    };

    this.metrics.set(name, metric);
    
    // Report if endpoint configured
    if (this.config.reportingEndpoint) {
      this.reportMetric(metric);
    }

    // Trigger optimizations if metric is poor
    if (metric.rating === 'poor' && this.config.enableOptimizations) {
      this.triggerOptimizations(metric);
    }
  }

  /**
   * Calculate metric rating
   */
  private calculateRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = this.config.thresholds[metricName.toLowerCase() as keyof typeof this.config.thresholds];
    
    if (!thresholds) return 'good';
    
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Report metric to endpoint
   */
  private async reportMetric(metric: VitalMetric): Promise<void> {
    try {
      await fetch(this.config.reportingEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.warn('Failed to report metric:', error);
    }
  }

  /**
   * Trigger optimizations for poor metrics
   */
  private triggerOptimizations(metric: VitalMetric): void {
    switch (metric.name) {
      case 'LCP':
        this.optimizeLCP();
        break;
      case 'FID':
        this.optimizeFID();
        break;
      case 'CLS':
        this.optimizeCLS();
        break;
      case 'FCP':
        this.optimizeFCP();
        break;
      case 'TTFB':
        this.optimizeTTFB();
        break;
    }
  }

  /**
   * Optimize Largest Contentful Paint
   */
  private optimizeLCP(): void {
    // Preload LCP element
    const lcpElement = this.findLCPElement();
    if (lcpElement) {
      this.preloadLCPResource(lcpElement);
    }

    // Optimize images
    this.optimizeLCPImages();
    
    // Remove render-blocking resources
    this.optimizeRenderBlocking();
  }

  /**
   * Optimize First Input Delay
   */
  private optimizeFID(): void {
    // Break up long tasks
    this.breakUpLongTasks();
    
    // Use web workers for heavy computations
    this.suggestWebWorkers();
    
    // Optimize third-party scripts
    this.optimizeThirdPartyScripts();
  }

  /**
   * Optimize Cumulative Layout Shift
   */
  private optimizeCLS(): void {
    // Add size attributes to images
    this.addImageDimensions();
    
    // Reserve space for ads
    this.reserveAdSpace();
    
    // Optimize font loading
    this.optimizeFontLoading();
  }

  /**
   * Optimize First Contentful Paint
   */
  private optimizeFCP(): void {
    // Inline critical CSS
    this.inlineCriticalCSS();
    
    // Optimize web fonts
    this.optimizeWebFonts();
    
    // Remove unused CSS
    this.removeUnusedCSS();
  }

  /**
   * Optimize Time to First Byte
   */
  private optimizeTTFB(): void {
    // Enable server-side optimizations
    console.log('📡 TTFB optimization suggestions:');
    console.log('- Enable server-side caching');
    console.log('- Use CDN for static assets');
    console.log('- Optimize server response time');
    console.log('- Use HTTP/2 or HTTP/3');
  }

  /**
   * Find LCP element
   */
  private findLCPElement(): Element | null {
    const lcpMetric = this.metrics.get('LCP');
    if (!lcpMetric || !lcpMetric.entries.length) return null;

    const lcpEntry = lcpMetric.entries[0] as any;
    return lcpEntry.element || null;
  }

  /**
   * Preload LCP resource
   */
  private preloadLCPResource(element: Element): void {
    if (element instanceof HTMLImageElement) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = element.src;
      link.as = 'image';
      document.head.appendChild(link);
    }
  }

  /**
   * Optimize LCP images
   */
  private optimizeLCPImages(): void {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      // Add loading="eager" to above-fold images
      if (this.isAboveFold(img)) {
        img.loading = 'eager';
      }
      
      // Add fetchpriority="high" to LCP candidates
      if (this.isLCPCandidate(img)) {
        (img as any).fetchPriority = 'high';
      }
    });
  }

  /**
   * Check if element is above the fold
   */
  private isAboveFold(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight;
  }

  /**
   * Check if image is LCP candidate
   */
  private isLCPCandidate(img: HTMLImageElement): boolean {
    const rect = img.getBoundingClientRect();
    const area = rect.width * rect.height;
    const viewportArea = window.innerWidth * window.innerHeight;
    
    // Consider images that take up significant viewport space
    return area > viewportArea * 0.2;
  }

  /**
   * Optimize render-blocking resources
   */
  private optimizeRenderBlocking(): void {
    // Add async/defer to non-critical scripts
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      if (!script.hasAttribute('async') && !script.hasAttribute('defer')) {
        script.setAttribute('defer', '');
      }
    });
  }

  /**
   * Break up long tasks
   */
  private breakUpLongTasks(): void {
    console.log('⚡ Consider breaking up long tasks:');
    console.log('- Use setTimeout() to yield to main thread');
    console.log('- Use requestIdleCallback() for non-critical work');
    console.log('- Implement time slicing for heavy operations');
  }

  /**
   * Suggest web workers
   */
  private suggestWebWorkers(): void {
    console.log('👷 Consider using Web Workers for:');
    console.log('- Heavy data processing');
    console.log('- Complex calculations');
    console.log('- Background API calls');
  }

  /**
   * Optimize third-party scripts
   */
  private optimizeThirdPartyScripts(): void {
    const thirdPartyScripts = document.querySelectorAll('script[src*="//"]');
    thirdPartyScripts.forEach(script => {
      // Add loading strategies
      if (!script.hasAttribute('async')) {
        script.setAttribute('async', '');
      }
    });
  }

  /**
   * Add image dimensions to prevent CLS
   */
  private addImageDimensions(): void {
    const images = document.querySelectorAll('img:not([width]):not([height])');
    images.forEach(img => {
      // Calculate aspect ratio and add CSS
      img.style.aspectRatio = '16 / 9'; // Default ratio
      console.log('📐 Add explicit dimensions to prevent layout shift');
    });
  }

  /**
   * Reserve space for ads
   */
  private reserveAdSpace(): void {
    const adContainers = document.querySelectorAll('[class*="ad"], [id*="ad"]');
    adContainers.forEach(container => {
      if (!container.getAttribute('style')?.includes('height')) {
        (container as HTMLElement).style.minHeight = '250px';
      }
    });
  }

  /**
   * Optimize font loading
   */
  private optimizeFontLoading(): void {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'OptimizedFont';
        font-display: swap;
        src: url('font.woff2') format('woff2');
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inline critical CSS
   */
  private inlineCriticalCSS(): void {
    console.log('🎨 Critical CSS optimization suggestions:');
    console.log('- Extract above-the-fold CSS');
    console.log('- Inline critical styles in <head>');
    console.log('- Load non-critical CSS asynchronously');
  }

  /**
   * Optimize web fonts
   */
  private optimizeWebFonts(): void {
    const fontLinks = document.querySelectorAll('link[href*="fonts"]');
    fontLinks.forEach(link => {
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'font');
      link.setAttribute('crossorigin', '');
    });
  }

  /**
   * Remove unused CSS
   */
  private removeUnusedCSS(): void {
    console.log('🧹 CSS optimization suggestions:');
    console.log('- Use PurgeCSS to remove unused styles');
    console.log('- Minimize CSS bundle size');
    console.log('- Use CSS-in-JS for component-specific styles');
  }

  /**
   * Generate comprehensive report
   */
  generateReport(): WebVitalsReport {
    const metrics = Object.fromEntries(this.metrics);
    const optimizations = this.generateOptimizations();
    const recommendations = this.generateRecommendations();
    const performance = this.calculatePerformanceScore();

    return {
      metrics,
      optimizations,
      recommendations,
      performance
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizations(): Optimization[] {
    const optimizations: Optimization[] = [];
    
    this.metrics.forEach((metric, name) => {
      if (metric.rating === 'poor') {
        switch (name) {
          case 'LCP':
            optimizations.push({
              type: 'lcp',
              description: 'Optimize Largest Contentful Paint',
              impact: 'high',
              implementation: 'Preload LCP resource, optimize images, remove render-blocking CSS',
              estimatedImprovement: 40
            });
            break;
          case 'CLS':
            optimizations.push({
              type: 'cls',
              description: 'Reduce Cumulative Layout Shift',
              impact: 'high',
              implementation: 'Add image dimensions, reserve space for dynamic content',
              estimatedImprovement: 60
            });
            break;
        }
      }
    });

    return optimizations;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    this.metrics.forEach((metric, name) => {
      if (metric.rating !== 'good') {
        recommendations.push({
          metric: name,
          issue: `${name} score is ${metric.rating}`,
          solution: this.getRecommendationForMetric(name),
          priority: metric.rating === 'poor' ? 'high' : 'medium'
        });
      }
    });

    return recommendations;
  }

  /**
   * Get recommendation for specific metric
   */
  private getRecommendationForMetric(metricName: string): string {
    const recommendations: Record<string, string> = {
      'LCP': 'Optimize server response times, render-blocking resources, and resource load times',
      'FID': 'Reduce JavaScript execution time, break up long tasks, use web workers',
      'CLS': 'Include size attributes on images and video elements, ensure ad elements have reserved space',
      'FCP': 'Eliminate render-blocking resources, minify CSS, remove unused CSS',
      'TTFB': 'Use a CDN, optimize server configuration, consider edge-side includes'
    };

    return recommendations[metricName] || 'Optimize this metric for better performance';
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(): { score: number; grade: string } {
    let score = 100;
    let totalMetrics = 0;

    this.metrics.forEach(metric => {
      totalMetrics++;
      if (metric.rating === 'needs-improvement') {
        score -= 10;
      } else if (metric.rating === 'poor') {
        score -= 25;
      }
    });

    const normalizedScore = Math.max(0, score);
    const grade = this.calculateGrade(normalizedScore);

    return { score: normalizedScore, grade };
  }

  /**
   * Calculate letter grade
   */
  private calculateGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): Record<string, VitalMetric> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Destroy optimizer
   */
  destroy(): void {
    if (this.observer) this.observer.disconnect();
    if (this.lcpObserver) this.lcpObserver.disconnect();
    if (this.clsObserver) this.clsObserver.disconnect();
    this.clearMetrics();
  }
}

/**
 * Web Vitals utilities
 */
export class WebVitalsUtils {
  /**
   * Format metric value for display
   */
  static formatMetricValue(metricName: string, value: number): string {
    switch (metricName) {
      case 'CLS':
        return value.toFixed(3);
      case 'LCP':
      case 'FCP':
      case 'FID':
      case 'TTFB':
        return `${Math.round(value)}ms`;
      default:
        return value.toString();
    }
  }

  /**
   * Get metric color based on rating
   */
  static getMetricColor(rating: string): string {
    switch (rating) {
      case 'good': return '#0CCE6B';
      case 'needs-improvement': return '#FFA400';
      case 'poor': return '#FF4E42';
      default: return '#666';
    }
  }

  /**
   * Check browser support for Web Vitals
   */
  static checkBrowserSupport(): Record<string, boolean> {
    return {
      performanceObserver: 'PerformanceObserver' in window,
      largestContentfulPaint: 'PerformanceObserver' in window && 
        PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint'),
      firstInputDelay: 'PerformanceObserver' in window && 
        PerformanceObserver.supportedEntryTypes?.includes('first-input'),
      cumulativeLayoutShift: 'PerformanceObserver' in window && 
        PerformanceObserver.supportedEntryTypes?.includes('layout-shift')
    };
  }
}
