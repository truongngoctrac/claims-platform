/**
 * Comprehensive Performance Monitoring System
 * Real-time performance tracking and analytics for healthcare claims app
 */

export interface PerformanceConfig {
  enableRealTimeMonitoring: boolean;
  enableResourceTiming: boolean;
  enableUserTiming: boolean;
  enableNavigationTiming: boolean;
  reportingInterval: number;
  bufferSize: number;
  endpoint?: string;
  enableErrorTracking: boolean;
}

export interface PerformanceMetrics {
  webVitals: WebVitalsData;
  timing: TimingData;
  resources: ResourceData[];
  userInteractions: UserInteractionData[];
  errors: ErrorData[];
  memory: MemoryData;
  network: NetworkData;
}

export interface WebVitalsData {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

export interface TimingData {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  timeToInteractive: number;
}

export interface ResourceData {
  name: string;
  type: string;
  size: number;
  loadTime: number;
  cached: boolean;
  blocked: boolean;
}

export interface UserInteractionData {
  type: string;
  target: string;
  timestamp: number;
  duration?: number;
}

export interface ErrorData {
  message: string;
  source: string;
  line: number;
  column: number;
  stack?: string;
  timestamp: number;
}

export interface MemoryData {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface NetworkData {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private observers: PerformanceObserver[] = [];
  private reportingTimer?: NodeJS.Timeout;
  private startTime = performance.now();

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      enableResourceTiming: true,
      enableUserTiming: true,
      enableNavigationTiming: true,
      reportingInterval: 30000, // 30 seconds
      bufferSize: 100,
      enableErrorTracking: true,
      ...config
    };

    this.metrics = {
      webVitals: {},
      timing: {} as TimingData,
      resources: [],
      userInteractions: [],
      errors: [],
      memory: {} as MemoryData,
      network: {} as NetworkData
    };

    this.initialize();
  }

  /**
   * Initialize monitoring systems
   */
  private initialize(): void {
    if (!this.config.enableRealTimeMonitoring) return;

    this.setupNavigationTiming();
    this.setupResourceTiming();
    this.setupUserTiming();
    this.setupWebVitalsMonitoring();
    this.setupErrorTracking();
    this.setupMemoryMonitoring();
    this.setupNetworkMonitoring();
    this.setupUserInteractionTracking();
    this.startReporting();
  }

  /**
   * Setup navigation timing monitoring
   */
  private setupNavigationTiming(): void {
    if (!this.config.enableNavigationTiming) return;

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      this.metrics.timing = {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstPaint: this.getFirstPaint(),
        timeToInteractive: this.calculateTTI()
      };
    });
  }

  /**
   * Setup resource timing monitoring
   */
  private setupResourceTiming(): void {
    if (!this.config.enableResourceTiming) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceResourceTiming[];
      
      entries.forEach(entry => {
        const resource: ResourceData = {
          name: entry.name,
          type: this.getResourceType(entry.name),
          size: entry.transferSize || 0,
          loadTime: entry.responseEnd - entry.requestStart,
          cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
          blocked: entry.responseStart - entry.requestStart > 100
        };
        
        this.metrics.resources.push(resource);
        
        // Keep buffer size limited
        if (this.metrics.resources.length > this.config.bufferSize) {
          this.metrics.resources.shift();
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
    this.observers.push(observer);
  }

  /**
   * Setup user timing monitoring
   */
  private setupUserTiming(): void {
    if (!this.config.enableUserTiming) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        console.log(`📊 User Timing: ${entry.name} - ${entry.duration}ms`);
      });
    });

    observer.observe({ entryTypes: ['measure'] });
    this.observers.push(observer);
  }

  /**
   * Setup Web Vitals monitoring
   */
  private setupWebVitalsMonitoring(): void {
    // LCP monitoring
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (lastEntry) {
          this.metrics.webVitals.lcp = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (e) {
      console.warn('LCP monitoring not supported');
    }

    // FID monitoring
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.webVitals.fid = entry.processingStart - entry.startTime;
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (e) {
      console.warn('FID monitoring not supported');
    }

    // CLS monitoring
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.webVitals.cls = clsValue;
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (e) {
      console.warn('CLS monitoring not supported');
    }

    // FCP monitoring
    try {
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.webVitals.fcp = fcpEntry.startTime;
        }
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);
    } catch (e) {
      console.warn('Paint timing not supported');
    }

    // TTFB monitoring
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.metrics.webVitals.ttfb = navigation.responseStart - navigation.requestStart;
    }
  }

  /**
   * Setup error tracking
   */
  private setupErrorTracking(): void {
    if (!this.config.enableErrorTracking) return;

    // JavaScript errors
    window.addEventListener('error', (event) => {
      const error: ErrorData = {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now()
      };
      
      this.metrics.errors.push(error);
      
      if (this.metrics.errors.length > this.config.bufferSize) {
        this.metrics.errors.shift();
      }
    });

    // Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error: ErrorData = {
        message: event.reason?.message || 'Unhandled Promise Rejection',
        source: 'promise',
        line: 0,
        column: 0,
        stack: event.reason?.stack,
        timestamp: Date.now()
      };
      
      this.metrics.errors.push(error);
    });
  }

  /**
   * Setup memory monitoring
   */
  private setupMemoryMonitoring(): void {
    if (!(performance as any).memory) return;

    const updateMemoryMetrics = () => {
      const memory = (performance as any).memory;
      this.metrics.memory = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };
    };

    // Update memory metrics every 10 seconds
    setInterval(updateMemoryMetrics, 10000);
    updateMemoryMetrics(); // Initial reading
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      this.metrics.network = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false
      };

      // Listen for network changes
      connection.addEventListener('change', () => {
        this.metrics.network = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        };
      });
    }
  }

  /**
   * Setup user interaction tracking
   */
  private setupUserInteractionTracking(): void {
    const interactionEvents = ['click', 'keydown', 'scroll', 'resize'];
    
    interactionEvents.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        const interaction: UserInteractionData = {
          type: eventType,
          target: this.getEventTargetSelector(event.target as Element),
          timestamp: Date.now()
        };
        
        this.metrics.userInteractions.push(interaction);
        
        if (this.metrics.userInteractions.length > this.config.bufferSize) {
          this.metrics.userInteractions.shift();
        }
      }, { passive: true });
    });
  }

  /**
   * Get event target selector
   */
  private getEventTargetSelector(element: Element): string {
    if (!element) return 'unknown';
    
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  /**
   * Start periodic reporting
   */
  private startReporting(): void {
    if (!this.config.endpoint) return;

    this.reportingTimer = setInterval(() => {
      this.sendReport();
    }, this.config.reportingInterval);
  }

  /**
   * Send performance report
   */
  private async sendReport(): Promise<void> {
    if (!this.config.endpoint) return;

    try {
      const report = {
        ...this.metrics,
        sessionDuration: performance.now() - this.startTime,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      };

      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
    } catch (error) {
      console.warn('Failed to send performance report:', error);
    }
  }

  /**
   * Get resource type from URL
   */
  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) return 'image';
    if (['css'].includes(extension || '')) return 'stylesheet';
    if (['js'].includes(extension || '')) return 'script';
    if (['woff', 'woff2', 'ttf', 'eot'].includes(extension || '')) return 'font';
    if (url.includes('/api/')) return 'xhr';
    
    return 'other';
  }

  /**
   * Get first paint time
   */
  private getFirstPaint(): number {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : 0;
  }

  /**
   * Calculate Time to Interactive (simplified)
   */
  private calculateTTI(): number {
    // Simplified TTI calculation
    // In production, use a proper TTI library
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navigation ? navigation.domInteractive - navigation.navigationStart : 0;
  }

  /**
   * Mark performance timing
   */
  mark(name: string): void {
    performance.mark(name);
  }

  /**
   * Measure performance between marks
   */
  measure(name: string, startMark: string, endMark?: string): void {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const sessionDuration = (performance.now() - this.startTime) / 1000;

    return `
# Performance Monitoring Report

## Session Overview
- **Duration**: ${sessionDuration.toFixed(2)}s
- **Page**: ${window.location.pathname}
- **User Agent**: ${navigator.userAgent.split(' ')[0]}

## Web Vitals
- **LCP**: ${metrics.webVitals.lcp ? `${Math.round(metrics.webVitals.lcp)}ms` : 'Not measured'}
- **FID**: ${metrics.webVitals.fid ? `${Math.round(metrics.webVitals.fid)}ms` : 'Not measured'}
- **CLS**: ${metrics.webVitals.cls ? metrics.webVitals.cls.toFixed(3) : 'Not measured'}
- **FCP**: ${metrics.webVitals.fcp ? `${Math.round(metrics.webVitals.fcp)}ms` : 'Not measured'}
- **TTFB**: ${metrics.webVitals.ttfb ? `${Math.round(metrics.webVitals.ttfb)}ms` : 'Not measured'}

## Timing
- **DOM Content Loaded**: ${Math.round(metrics.timing.domContentLoaded)}ms
- **Load Complete**: ${Math.round(metrics.timing.loadComplete)}ms
- **First Paint**: ${Math.round(metrics.timing.firstPaint)}ms
- **Time to Interactive**: ${Math.round(metrics.timing.timeToInteractive)}ms

## Resources
- **Total Resources**: ${metrics.resources.length}
- **Cached Resources**: ${metrics.resources.filter(r => r.cached).length}
- **Blocked Resources**: ${metrics.resources.filter(r => r.blocked).length}
- **Average Load Time**: ${metrics.resources.length > 0 ? 
    Math.round(metrics.resources.reduce((sum, r) => sum + r.loadTime, 0) / metrics.resources.length) : 0}ms

## Memory (if available)
${metrics.memory.usedJSHeapSize ? `
- **Used Heap**: ${Math.round(metrics.memory.usedJSHeapSize / 1024 / 1024)}MB
- **Total Heap**: ${Math.round(metrics.memory.totalJSHeapSize / 1024 / 1024)}MB
- **Heap Limit**: ${Math.round(metrics.memory.jsHeapSizeLimit / 1024 / 1024)}MB
` : '- Memory metrics not available'}

## Network
- **Connection Type**: ${metrics.network.effectiveType || 'Unknown'}
- **Downlink**: ${metrics.network.downlink || 0} Mbps
- **RTT**: ${metrics.network.rtt || 0}ms
- **Save Data**: ${metrics.network.saveData ? 'Enabled' : 'Disabled'}

## Errors
- **JavaScript Errors**: ${metrics.errors.length}
${metrics.errors.slice(0, 5).map(error => `  - ${error.message}`).join('\n')}

## User Interactions
- **Total Interactions**: ${metrics.userInteractions.length}
- **Most Common**: ${this.getMostCommonInteraction(metrics.userInteractions)}
    `.trim();
  }

  /**
   * Get most common interaction type
   */
  private getMostCommonInteraction(interactions: UserInteractionData[]): string {
    const counts = interactions.reduce((acc, interaction) => {
      acc[interaction.type] = (acc[interaction.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(counts).sort(([,a], [,b]) => b - a)[0];
    return mostCommon ? `${mostCommon[0]} (${mostCommon[1]} times)` : 'None';
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = {
      webVitals: {},
      timing: {} as TimingData,
      resources: [],
      userInteractions: [],
      errors: [],
      memory: {} as MemoryData,
      network: {} as NetworkData
    };
  }

  /**
   * Destroy monitor
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }
    this.clearMetrics();
  }
}

/**
 * Performance utilities
 */
export class PerformanceUtils {
  /**
   * Format timing value
   */
  static formatTiming(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Format size value
   */
  static formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Get performance grade
   */
  static getPerformanceGrade(metrics: PerformanceMetrics): string {
    let score = 100;

    // Penalize poor Web Vitals
    if (metrics.webVitals.lcp && metrics.webVitals.lcp > 2500) score -= 20;
    if (metrics.webVitals.fid && metrics.webVitals.fid > 100) score -= 15;
    if (metrics.webVitals.cls && metrics.webVitals.cls > 0.1) score -= 15;
    if (metrics.webVitals.fcp && metrics.webVitals.fcp > 1800) score -= 10;

    // Penalize errors
    score -= Math.min(metrics.errors.length * 5, 30);

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}
