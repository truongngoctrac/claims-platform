/**
 * Resource Preloading System
 * Intelligent preloading strategies for optimal performance
 */

export interface PreloadConfig {
  preloadDelay: number;
  maxConcurrency: number;
  priorityResources: string[];
  preloadStrategy: 'immediate' | 'viewport' | 'interaction' | 'idle';
  resourceTypes: ResourceType[];
}

export interface ResourceType {
  type: 'script' | 'style' | 'image' | 'font' | 'document';
  crossorigin?: boolean;
  integrity?: string;
  media?: string;
}

export interface PreloadResource {
  href: string;
  as: string;
  type?: string;
  crossorigin?: boolean;
  integrity?: string;
  priority: 'high' | 'medium' | 'low';
  strategy: 'preload' | 'prefetch' | 'preconnect' | 'dns-prefetch';
}

export class ResourcePreloader {
  private config: PreloadConfig;
  private preloadedResources = new Set<string>();
  private preloadQueue: PreloadResource[] = [];
  private isProcessing = false;
  private intersectionObserver?: IntersectionObserver;
  private idleCallback?: number;

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = {
      preloadDelay: 100,
      maxConcurrency: 6,
      priorityResources: [],
      preloadStrategy: 'viewport',
      resourceTypes: [
        { type: 'script' },
        { type: 'style' },
        { type: 'image' },
        { type: 'font', crossorigin: true }
      ],
      ...config
    };

    this.initializePreloadStrategies();
  }

  /**
   * Initialize preload strategies
   */
  private initializePreloadStrategies(): void {
    switch (this.config.preloadStrategy) {
      case 'immediate':
        this.startImmediatePreloading();
        break;
      case 'viewport':
        this.setupViewportPreloading();
        break;
      case 'interaction':
        this.setupInteractionPreloading();
        break;
      case 'idle':
        this.setupIdlePreloading();
        break;
    }
  }

  /**
   * Preload resource immediately
   */
  preload(resource: PreloadResource): Promise<void> {
    if (this.preloadedResources.has(resource.href)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = resource.strategy;
      link.href = resource.href;
      link.as = resource.as;

      if (resource.type) link.type = resource.type;
      if (resource.crossorigin) link.crossOrigin = 'anonymous';
      if (resource.integrity) link.integrity = resource.integrity;

      link.onload = () => {
        this.preloadedResources.add(resource.href);
        resolve();
      };
      
      link.onerror = () => {
        reject(new Error(`Failed to preload: ${resource.href}`));
      };

      document.head.appendChild(link);
    });
  }

  /**
   * Add resource to preload queue
   */
  queuePreload(resource: PreloadResource): void {
    // Check if already preloaded or queued
    if (this.preloadedResources.has(resource.href) || 
        this.preloadQueue.some(r => r.href === resource.href)) {
      return;
    }

    this.preloadQueue.push(resource);
    this.processQueue();
  }

  /**
   * Process preload queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.preloadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Sort by priority
    this.preloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Process resources with concurrency limit
    const batch = this.preloadQueue.splice(0, this.config.maxConcurrency);
    
    try {
      await Promise.all(batch.map(resource => this.preload(resource)));
    } catch (error) {
      console.warn('Error preloading resources:', error);
    }

    this.isProcessing = false;

    // Process next batch if queue has items
    if (this.preloadQueue.length > 0) {
      setTimeout(() => this.processQueue(), this.config.preloadDelay);
    }
  }

  /**
   * Start immediate preloading
   */
  private startImmediatePreloading(): void {
    // Preload priority resources immediately
    this.config.priorityResources.forEach(href => {
      this.queuePreload({
        href,
        as: this.detectResourceType(href),
        priority: 'high',
        strategy: 'preload'
      });
    });
  }

  /**
   * Setup viewport-based preloading
   */
  private setupViewportPreloading(): void {
    if (!IntersectionObserver) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const href = this.extractResourceHref(element);
            
            if (href) {
              this.queuePreload({
                href,
                as: this.detectResourceType(href),
                priority: 'medium',
                strategy: 'preload'
              });
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    // Observe elements with data-preload attribute
    document.querySelectorAll('[data-preload]').forEach(element => {
      this.intersectionObserver!.observe(element);
    });
  }

  /**
   * Setup interaction-based preloading
   */
  private setupInteractionPreloading(): void {
    const interactionEvents = ['mouseenter', 'touchstart', 'focus'];
    
    interactionEvents.forEach(event => {
      document.addEventListener(event, (e) => {
        const target = e.target as HTMLElement;
        const href = this.extractResourceHref(target);
        
        if (href) {
          this.queuePreload({
            href,
            as: this.detectResourceType(href),
            priority: 'high',
            strategy: 'preload'
          });
        }
      }, { passive: true });
    });
  }

  /**
   * Setup idle-time preloading
   */
  private setupIdlePreloading(): void {
    const requestIdleCallback = window.requestIdleCallback || 
      ((cb: IdleRequestCallback) => setTimeout(cb, 1));

    requestIdleCallback(() => {
      this.preloadLowPriorityResources();
    });
  }

  /**
   * Preload low priority resources during idle time
   */
  private preloadLowPriorityResources(): void {
    // Find resources that can be preloaded during idle time
    const lowPriorityResources = this.findLowPriorityResources();
    
    lowPriorityResources.forEach(href => {
      this.queuePreload({
        href,
        as: this.detectResourceType(href),
        priority: 'low',
        strategy: 'prefetch'
      });
    });
  }

  /**
   * Find low priority resources
   */
  private findLowPriorityResources(): string[] {
    const resources: string[] = [];
    
    // Find images not in viewport
    document.querySelectorAll('img[data-src]').forEach(img => {
      const src = img.getAttribute('data-src');
      if (src) resources.push(src);
    });

    // Find async scripts
    document.querySelectorAll('script[async][data-preload]').forEach(script => {
      const src = script.getAttribute('src');
      if (src) resources.push(src);
    });

    return resources;
  }

  /**
   * Extract resource href from element
   */
  private extractResourceHref(element: HTMLElement): string | null {
    // Check common attributes
    if (element instanceof HTMLLinkElement) return element.href;
    if (element instanceof HTMLScriptElement) return element.src;
    if (element instanceof HTMLImageElement) return element.src || element.dataset.src || null;
    if (element instanceof HTMLAnchorElement) return element.href;

    // Check data attributes
    return element.dataset.preload || element.dataset.src || null;
  }

  /**
   * Detect resource type from URL
   */
  private detectResourceType(href: string): string {
    const extension = href.split('.').pop()?.toLowerCase();
    
    const typeMap: Record<string, string> = {
      'js': 'script',
      'css': 'style',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'webp': 'image',
      'svg': 'image',
      'woff': 'font',
      'woff2': 'font',
      'ttf': 'font',
      'eot': 'font',
      'html': 'document',
      'json': 'fetch'
    };

    return typeMap[extension || ''] || 'fetch';
  }

  /**
   * Preconnect to external domains
   */
  preconnectToDomains(domains: string[]): void {
    domains.forEach(domain => {
      // DNS prefetch
      const dnsLink = document.createElement('link');
      dnsLink.rel = 'dns-prefetch';
      dnsLink.href = domain;
      document.head.appendChild(dnsLink);

      // Preconnect
      const preconnectLink = document.createElement('link');
      preconnectLink.rel = 'preconnect';
      preconnectLink.href = domain;
      preconnectLink.crossOrigin = 'anonymous';
      document.head.appendChild(preconnectLink);
    });
  }

  /**
   * Prefetch next page resources
   */
  prefetchNextPage(url: string): Promise<void> {
    return this.preload({
      href: url,
      as: 'document',
      priority: 'low',
      strategy: 'prefetch'
    });
  }

  /**
   * Get preload statistics
   */
  getStats(): {
    preloaded: number;
    queued: number;
    domains: string[];
  } {
    const domains = Array.from(this.preloadedResources).map(href => {
      try {
        return new URL(href).hostname;
      } catch {
        return 'localhost';
      }
    });

    return {
      preloaded: this.preloadedResources.size,
      queued: this.preloadQueue.length,
      domains: [...new Set(domains)]
    };
  }

  /**
   * Clear preload cache
   */
  clearCache(): void {
    this.preloadedResources.clear();
    this.preloadQueue = [];
  }

  /**
   * Destroy preloader
   */
  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback);
    }
    this.clearCache();
  }
}

/**
 * Smart Font Preloader
 */
export class FontPreloader {
  private loadedFonts = new Set<string>();

  /**
   * Preload font with optimal strategy
   */
  async preloadFont(
    fontUrl: string, 
    fontDisplay: 'swap' | 'fallback' | 'optional' = 'swap'
  ): Promise<void> {
    if (this.loadedFonts.has(fontUrl)) return;

    // Method 1: Link preload
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = fontUrl;
    link.as = 'font';
    link.type = this.getFontType(fontUrl);
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    // Method 2: Font Loading API (if supported)
    if ('fonts' in document) {
      try {
        const fontFace = new FontFace(
          this.extractFontFamily(fontUrl),
          `url(${fontUrl})`,
          { display: fontDisplay }
        );
        
        await fontFace.load();
        document.fonts.add(fontFace);
        this.loadedFonts.add(fontUrl);
      } catch (error) {
        console.warn('Font loading failed:', error);
      }
    }
  }

  /**
   * Get font type from URL
   */
  private getFontType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'woff2': 'font/woff2',
      'woff': 'font/woff',
      'ttf': 'font/truetype',
      'otf': 'font/opentype',
      'eot': 'application/vnd.ms-fontobject'
    };
    return typeMap[extension || ''] || 'font/woff2';
  }

  /**
   * Extract font family name from URL
   */
  private extractFontFamily(url: string): string {
    const filename = url.split('/').pop()?.split('.')[0] || 'Unknown';
    return filename.replace(/[-_]/g, ' ');
  }
}

/**
 * Route-based preloader
 */
export class RoutePreloader {
  private router: any;
  private preloadedRoutes = new Set<string>();

  constructor(router: any) {
    this.router = router;
    this.setupRoutePreloading();
  }

  /**
   * Setup automatic route preloading
   */
  private setupRoutePreloading(): void {
    // Preload on link hover
    document.addEventListener('mouseenter', (e) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLAnchorElement) {
        this.preloadRoute(target.pathname);
      }
    }, true);

    // Preload on focus (keyboard navigation)
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLAnchorElement) {
        this.preloadRoute(target.pathname);
      }
    }, true);
  }

  /**
   * Preload route resources
   */
  async preloadRoute(path: string): Promise<void> {
    if (this.preloadedRoutes.has(path)) return;

    try {
      // This would integrate with your router's preload mechanism
      // For React Router, you might preload route components
      // For Next.js, you might use router.prefetch()
      
      if (this.router?.prefetch) {
        await this.router.prefetch(path);
      }
      
      this.preloadedRoutes.add(path);
    } catch (error) {
      console.warn(`Failed to preload route: ${path}`, error);
    }
  }

  /**
   * Preload critical routes
   */
  preloadCriticalRoutes(routes: string[]): void {
    routes.forEach(route => {
      this.preloadRoute(route);
    });
  }
}
